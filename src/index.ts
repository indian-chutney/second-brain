import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { z } from "zod";
import bcrypt from "bcrypt";
import * as dotenv from "dotenv";

import { UserModel, ContentModel, TagsModel, LinkModel } from "./db";
import { authenticate } from "./middleware";
import { hashnum } from "./utils/hashnum";
dotenv.config();
const app = express();
app.use(express.json());

app.post(
  "/api/v1/signup",
  async (req: express.Request, res: express.Response) => {
    const reqBody = z.object({
      email: z.string().email(),
      username: z.string().min(5).max(12),
      password: z.string().min(8).max(20),
    });

    const parsed = reqBody.safeParse(req.body);
    console.log(parsed);

    if (!parsed.success) {
      return void res.status(403).json({
        message: "invalid creds",
      });
    }

    const { email, username, password } = parsed.data;
    const hash_pwd = await bcrypt.hash(password, 5);

    try {
      await UserModel.create({
        email: email,
        username: username,
        password: hash_pwd,
      });

      return void res.json({
        message: "signup successful",
      });
    } catch (err) {
      return void res.status(500).json({
        message: "error creating to user",
      });
    }
  },
);

app.post(
  "/api/v1/signin",
  async (req: express.Request, res: express.Response) => {
    const { username, password } = req.body;

    try {
      const user = await UserModel.findOne({
        username: username,
      });

      if (!user) {
        return void res.status(403).json({
          message: "no username found",
        });
      }

      const pwd = await bcrypt.compare(password, user.password!);

      if (!pwd) {
        return void res.status(403).json({
          message: "wrong password",
        });
      }

      const token = jwt.sign(
        {
          id: user._id,
        },
        process.env.JWT_SECRET_KEY!,
      );

      res.json({
        token: token,
      });
    } catch (err) {
      return void res.status(500).json({
        message: "some issue with db",
      });
    }
  },
);

app.use(authenticate);

app.get(
  "/api/v1/content",
  async (req: express.Request, res: express.Response) => {
    const id = (req as any).userId;
    console.log(typeof id);
    const content = await ContentModel.find({
      userid: id,
    }).populate("userid", "username");

    console.log(content);

    res.json({
      content,
    });
    return;
  },
);

app.post(
  "/api/v1/content",
  async (req: express.Request, res: express.Response) => {
    const reqBody = z.object({
      link: z.string().url(),
      type: z.enum(["audio", "video", "image", "article"]),
      title: z.string().max(20),
      tags: z.array(z.string()),
    });

    if (!reqBody.safeParse(req.body)) {
      res.json({
        message: "invalid values",
      });
      return;
    }

    const { link, type, title, tags } = req.body;
    const id = (req as any).userId;

    const tags_ref = [];
    for (const tag of tags) {
      let ref = await TagsModel.findOne({
        title: tag,
      });

      if (!ref) {
        ref = await TagsModel.create({
          title: tag,
        });
      }
      tags_ref.push(ref!._id);
    }
    try {
      await ContentModel.create({
        link: link,
        type: type,
        title: title,
        tags: tags_ref,
        userid: id,
      });

      res.json({
        message: "data added in db",
      });
      return;
    } catch (err) {
      res.json({
        message: "error in db" + err,
      });
      return;
    }
  },
);

app.delete(
  "/api/v1/content/:deleteId",
  async (req: express.Request, res: express.Response) => {
    const delId = req.params.deleteId;

    await ContentModel.findOneAndDelete({
      _id: delId,
      userid: (req as any).userId,
    });

    res.json({
      message: "deleted content successfully",
    });
    return;
  },
);

app.post(
  "/api/v1/brain/share",
  async (req: express.Request, res: express.Response) => {
    try {
      const user = await UserModel.findOne({
        _id: (req as any).userId,
      });

      let hash = hashnum(user!.username!);

      const hash_exists = await LinkModel.findOne({
        hash: hash,
      });

      if (hash_exists) {
        res.json({
          message: "link already exists frontend_url" + hash,
        });
        return;
      }
      await LinkModel.create({
        hash: hash,
        userid: (req as any).userId,
      });

      res.json({
        link: "frontend_url" + hash,
      });
      return;
    } catch (err) {
      res.json({
        message: "error " + err,
      });
      return;
    }
  },
);

app.get(
  "/api/v1/brain/:shareLink",
  async (req: express.Request, res: express.Response) => {
    const link = req.params.shareLink;
    try {
      const user = await LinkModel.findOne({
        hash: link,
      });

      if (!user) {
        res.json({
          message: "can't find the link",
        });
        return;
      }

      const content = await ContentModel.find({
        userid: (user as any).userid,
      })
        .populate("userid", "username")
        .populate("tags", "title");

      if (content.length == 0) {
        res.json({
          message: "can't find the content/ maybe it was deleted",
        });
        return;
      }

      res.json({
        content,
      });
      return;
    } catch (err) {
      res.json({
        message: "error in db " + err,
      });
      return;
    }
  },
);

async function main() {
  try {
    await mongoose.connect(process.env.DB_CONNECTION_URL!);
    app.listen(3000);
    console.log("listening on port 3000");
  } catch (err) {
    console.log(err);
  }
}

main();
