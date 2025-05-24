"use strict";
// schemas
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkModel = exports.ContentModel = exports.TagsModel = exports.UserModel = void 0;
const mongoose_1 = require("mongoose");
const contentTypes = ["image", "article", "video", "audio"];
const users = new mongoose_1.Schema({
    email: { type: String, unique: true },
    username: { type: String, unique: true },
    password: { type: String },
});
const tags = new mongoose_1.Schema({
    title: { type: String },
});
const content = new mongoose_1.Schema({
    link: { type: String },
    type: { type: String, enum: contentTypes, required: true },
    title: { type: String },
    tags: [{ type: mongoose_1.Types.ObjectId, ref: "tags" }],
    userid: { type: mongoose_1.Types.ObjectId, ref: "users" },
});
const link = new mongoose_1.Schema({
    hash: { type: String },
    userid: { type: mongoose_1.Types.ObjectId, ref: "users" },
});
exports.UserModel = (0, mongoose_1.model)("users", users);
exports.TagsModel = (0, mongoose_1.model)("tags", tags);
exports.ContentModel = (0, mongoose_1.model)("content", content);
exports.LinkModel = (0, mongoose_1.model)("link", link);
