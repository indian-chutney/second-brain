"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const dotenv = __importStar(require("dotenv"));
const db_1 = require("./db");
const middleware_1 = require("./middleware");
const hashnum_1 = require("./utils/hashnum");
dotenv.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.post("/api/v1/signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const reqBody = zod_1.z.object({
        email: zod_1.z.string().email(),
        username: zod_1.z.string().min(5).max(12),
        password: zod_1.z.string().min(8).max(20),
    });
    const parsed = reqBody.safeParse(req.body);
    console.log(parsed);
    if (!parsed.success) {
        return void res.status(403).json({
            message: "invalid creds",
        });
    }
    const { email, username, password } = parsed.data;
    const hash_pwd = yield bcrypt_1.default.hash(password, 5);
    try {
        yield db_1.UserModel.create({
            email: email,
            username: username,
            password: hash_pwd,
        });
        return void res.json({
            message: "signup successful",
        });
    }
    catch (err) {
        return void res.status(500).json({
            message: "error creating to user",
        });
    }
}));
app.post("/api/v1/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    try {
        const user = yield db_1.UserModel.findOne({
            username: username,
        });
        if (!user) {
            return void res.status(403).json({
                message: "no username found",
            });
        }
        const pwd = yield bcrypt_1.default.compare(password, user.password);
        if (!pwd) {
            return void res.status(403).json({
                message: "wrong password",
            });
        }
        const token = jsonwebtoken_1.default.sign({
            id: user._id,
        }, process.env.JWT_SECRET_KEY);
        res.json({
            token: token,
        });
    }
    catch (err) {
        return void res.status(500).json({
            message: "some issue with db",
        });
    }
}));
app.use(middleware_1.authenticate);
app.get("/api/v1/content", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = req.userId;
    console.log(typeof id);
    const content = yield db_1.ContentModel.find({
        userid: id,
    }).populate("userid", "username");
    console.log(content);
    res.json({
        content,
    });
    return;
}));
app.post("/api/v1/content", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const reqBody = zod_1.z.object({
        link: zod_1.z.string().url(),
        type: zod_1.z.enum(["audio", "video", "image", "article"]),
        title: zod_1.z.string().max(20),
        tags: zod_1.z.array(zod_1.z.string()),
    });
    if (!reqBody.safeParse(req.body)) {
        res.json({
            message: "invalid values",
        });
        return;
    }
    const { link, type, title, tags } = req.body;
    const id = req.userId;
    const tags_ref = [];
    for (const tag of tags) {
        let ref = yield db_1.TagsModel.findOne({
            title: tag,
        });
        if (!ref) {
            ref = yield db_1.TagsModel.create({
                title: tag,
            });
        }
        tags_ref.push(ref._id);
    }
    try {
        yield db_1.ContentModel.create({
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
    }
    catch (err) {
        res.json({
            message: "error in db" + err,
        });
        return;
    }
}));
app.delete("/api/v1/content/:deleteId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const delId = req.params.deleteId;
    yield db_1.ContentModel.findOneAndDelete({
        _id: delId,
        userid: req.userId,
    });
    res.json({
        message: "deleted content successfully",
    });
    return;
}));
app.post("/api/v1/brain/share", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield db_1.UserModel.findOne({
            _id: req.userId,
        });
        let hash = (0, hashnum_1.hashnum)(user.username);
        const hash_exists = yield db_1.LinkModel.findOne({
            hash: hash,
        });
        if (hash_exists) {
            res.json({
                message: "link already exists frontend_url" + hash,
            });
            return;
        }
        yield db_1.LinkModel.create({
            hash: hash,
            userid: req.userId,
        });
        res.json({
            link: "frontend_url" + hash,
        });
        return;
    }
    catch (err) {
        res.json({
            message: "error " + err,
        });
        return;
    }
}));
app.get("/api/v1/brain/:shareLink", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const link = req.params.shareLink;
    try {
        const user = yield db_1.LinkModel.findOne({
            hash: link,
        });
        console.log(user);
        if (!user) {
            res.json({
                message: "can't find the link",
            });
            return;
        }
        const content = yield db_1.ContentModel.find({
            userid: user.userid,
        })
            .populate("userid", "username")
            .populate("tags", "title");
        if (content.length == 0) {
            res.json({
                message: "can't find the content/ maybe it was deleted",
            });
            return;
        }
        console.log(content);
        res.json({
            content,
        });
        return;
    }
    catch (err) {
        res.json({
            message: "error in db " + err,
        });
        return;
    }
}));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield mongoose_1.default.connect(process.env.DB_CONNECTION_URL);
            app.listen(3000);
            console.log("listening on port 3000");
        }
        catch (err) {
            console.log(err);
        }
    });
}
main();
