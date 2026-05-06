const express = require("express")
const http = require("http")
const cors = require("cors")
const {Server} = require("socket.io")
require("dotenv").config()

const connectDB = require("./config/db")

const authRoutes = require("./routes/auth")
const chatRoutes = require("./routes/chat")

const app = express()
const server = http.createServer(app)

const io = new Server(server,{
cors:{origin:"*"}
})

connectDB()

app.use(cors())
app.use(express.json())

app.use("/api/auth",authRoutes)
app.use("/api/chat",chatRoutes)

io.on("connection",(socket)=>{

console.log("user connected")

socket.on("chat message",(msg)=>{

io.emit("chat message",msg)

})

})

const PORT = process.env.PORT || 3000

server.listen(PORT,()=>{
console.log("server running "+PORT)
})
