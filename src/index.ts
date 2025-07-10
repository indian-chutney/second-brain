import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { z } from "zod";
import bcrypt from "bcrypt";
import * as dotenv from "dotenv";
import cors from "cors";

import { UserModel, ContentModel, TagsModel, LinkModel } from "./db";
import { authenticate } from "./middleware";
import { hashnum } from "./utils/hashnum";
dotenv.config();
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
  }),
);

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
      return void res.status(400).json({
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
        links: 0,
      });

      return void res.json({
        message: "signup successful",
      });
    } catch (err) {
      console.log(err);
      return void res.status(500).json({
        message: "User already exists",
      });
    }
  },
);

app.post(
  "/api/v1/signin",
  async (req: express.Request, res: express.Response) => {
    const { email, password } = req.body;

    try {
      const user = await UserModel.findOne({
        email: email,
      });

      if (!user) {
        return void res.status(403).json({
          message: "no user found",
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
    const content = await ContentModel.find({
      userid: id,
    })
      .populate("userid", "username")
      .populate("tags", "title");

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
      type: z.enum(["tweets", "notion", "audio", "video", "article"]),
      title: z.string().max(20),
      tags: z.array(z.string()),
    });

    if (!reqBody.safeParse(req.body)) {
      res.status(400).json({
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

app.get(
  "/api/v1/settings",
  async (req: express.Request, res: express.Response) => {
    const id = (req as any).userId;

    try {
      const userData = (await UserModel.findById(id).populate("links")) as any;

      if (!userData) {
        res.status(404).json({
          message: "User not found",
        });
        return;
      }

      const shareData = await LinkModel.findOne({ userid: id });
      let isShared, hash;
      if (shareData) {
        isShared = true;
        hash = shareData.hash;
      }

      res.json({
        username: userData.username,
        email: userData.email,
        links: userData.links,
        ...(isShared && {
          isShared: true,
          hash: hash,
        }),
      });
      return;
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).json({
        message: "Internal server error",
      });
      return;
    }
  },
);

app.post(
  "/api/v1/settings/change_password",
  async (req: express.Request, res: express.Response) => {
    const id = (req as any).userId;

    const given = req.body;

    try {
      const user = await UserModel.findById(id);

      if (!user) {
        res.status(404).json({
          message: "no user found with token",
        });
        return;
      }
      const result = await bcrypt.compare(
        given.old_pwd,
        user.password as string,
      );

      if (!result) {
        res.status(401).json({
          message: "wrong password",
        });
        return;
      }

      const update_pwd = given.new_pwd;
      if (!update_pwd) {
        res.status(400).json({
          message: "no new password given",
        });
        return;
      }

      await UserModel.findByIdAndUpdate(id, {
        password: bcrypt.hashSync(update_pwd, 5),
      });

      res.json({
        message: "successfully password updated",
      });
      return;
    } catch (err) {
      res.status(500).json({
        message: "error in db",
      });
    }
  },
);

app.delete(
  "/api/v1/content/:deleteId",
  async (req: express.Request, res: express.Response) => {
    const delId = req.params.deleteId;

    try {
      await ContentModel.findOneAndDelete({
        _id: delId,
        userid: (req as any).userId,
      });

      res.json({
        message: "deleted content successfully",
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

app.put(
  "/api/v1/content/:updateId",
  async (req: express.Request, res: express.Response) => {
    const updateId = req.params.updateId;

    const updateData = req.body;
    const reqBody = z.object({
      link: z.string().url().optional(),
      type: z
        .enum(["tweets", "notion", "audio", "video", "article"])
        .optional(),
      title: z.string().max(20).optional(),
      tags: z.array(z.string()).optional(),
    });

    const parsed = reqBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid data format",
      });
      return;
    }
    if (updateData.tags) {
      const tags_ref = [];
      for (const tag of updateData.tags) {
        let ref = await TagsModel.findOne({ title: tag });
        if (!ref) {
          ref = await TagsModel.create({ title: tag });
        }
        tags_ref.push(ref._id);
      }
      updateData.tags = tags_ref;
    }

    try {
      const updatedContent = await ContentModel.findOneAndUpdate(
        {
          _id: updateId,
          userid: (req as any).userId,
        },
        {
          ...updateData,
        },
        {
          new: true,
          runValidators: true,
        },
      );

      if (!updatedContent) {
        res.status(404).json({
          message:
            "Content not found or you don't have permission to update it",
        });
        return;
      }

      res.json({
        message: "Content updated successfully",
        data: updatedContent,
      });
      return;
    } catch (err) {
      res.status(500).json({
        message: "error in db" + err,
      });
      return;
    }
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
        link: hash,
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

export default app;
