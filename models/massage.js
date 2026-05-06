const mongoose = require("mongoose")

const MessageSchema = new mongoose.Schema({

user:String,
message:String,
time:{
type:Date,
default:Date.now
}

})

module.exports = mongoose.model("Message",MessageSchema)
