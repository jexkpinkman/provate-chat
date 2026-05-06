const router = require("express").Router()
const Message = require("../models/Message")

router.post("/send",async(req,res)=>{

const {user,message}=req.body

await Message.create({user,message})

res.json({status:"message sent"})

})

router.get("/messages",async(req,res)=>{

const messages = await Message.find()
.sort({time:-1})
.limit(50)

res.json(messages)

})

module.exports = router
