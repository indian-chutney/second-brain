// schemas

import { model, Schema, Types } from "mongoose";

const contentTypes = ["tweets", "notion", "article", "video", "other"];

const users = new Schema({
  email: { type: String, unique: true },
  username: { type: String, unique: true },
  password: { type: String },
});

users.virtual("links", {
  ref: "content",
  localField: "_id",
  foreignField: "userid",
  count: true,
});

const tags = new Schema({
  title: { type: String },
});

const content = new Schema({
  link: { type: String },
  type: { type: String, enum: contentTypes, required: true },
  title: { type: String },
  tags: [{ type: Types.ObjectId, ref: "tags" }],
  userid: { type: Types.ObjectId, ref: "users" },
});

const link = new Schema({
  hash: { type: String },
  userid: { type: Types.ObjectId, ref: "users" },
});

export const UserModel = model("users", users);
export const TagsModel = model("tags", tags);
export const ContentModel = model("content", content);
export const LinkModel = model("link", link);
