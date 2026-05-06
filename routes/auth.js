const router = require("express").Router()
const User = require("../models/User")

router.post("/register",async(req,res)=>{

const {username,password}=req.body

const exist = await User.findOne({username})

if(exist){
return res.json({status:"user sudah ada"})
}

await User.create({username,password})

res.json({status:"register sukses"})

})

router.post("/login",async(req,res)=>{

const {username,password}=req.body

const user = await User.findOne({username,password})

if(!user){
return res.json({status:"login gagal"})
}

res.json({status:"login sukses"})

})

module.exports = router
