import { timeStamp } from "console";
import { indexing } from "googleapis/build/src/apis/indexing/index.js";
import mongoose from "mongoose";
const PlatformSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true,indexing: true },   
    token: {type:String, required: true, unique: true},
  },{timeStamp:true}


)
const platformModel = mongoose.model("platform", PlatformSchema, "platform");
export default platformModel;