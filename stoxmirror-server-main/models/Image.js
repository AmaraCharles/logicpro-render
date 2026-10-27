const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  imageUrl: String,
  owner: String,
  docNum: String,
  ownerdet: String,
  status: String,
});

module.exports = mongoose.model("Image", imageSchema);
