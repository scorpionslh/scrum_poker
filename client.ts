import { io } from "socket.io-client";

const socket = io("http://127.0.0.1:3001", {
    reconnection: true
});

socket.on("connect", () => {
    console.log("connected")
    socket.emit('joinRoom', {room: 'test'})
    console.log("emit")
})

socket.on("userJoined", (data) => {
    console.log("userJoined")
})

socket.on("roomDetail", (data) => {
    console.log("roomDetail")
    console.log(data)
    socket.emit('vote', '5')
    socket.emit('showVotes')
})

socket.on("voted", (data) => {
    console.log("voted by:", data)
})

socket.on("showVotes", (data) => {
    console.log('showVotes')
    console.log(data)
})

socket.on("userLeft", (data) => {
    console.log("userLeft")
    console.log(data)
})
