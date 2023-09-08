interface User {
  id: string;
  vote?: string | null;
  isVoted: boolean;
  isAdmin: boolean;
  isSpectator: boolean;
}

interface Average {
  average: number;
  sd: number
}
interface ServerToClientEvents {
  roomDetail: (room: any) => void;
  userJoined: (user: User) => void;
  userLeft: (id: string) => void;
  voted: (id: string) => void;
  clear: (data: any) => void;
  id: (id: string) => void;
  showVotes: (data: any) => void;
  isSpectator: (data: User) => void;
  newRoom: (id: string) => void;
  sd: (data: Average) => void;
  listAllRooms: (data: any) => void;
  changeDeckOfCards: (data: string) => void;
}
interface ClientToServerEvents {
  joinRoom: (data: any) => void;
  vote: (vote: string | null) => void;
  clear: () => void;
  showVotes: () => void;
  isSpectator: () => void;
  newRoom: () => void;
  listAllRooms: () => void;
  changeDeckOfCards: (data: string) => void;
}

import { createServer } from "http";
import { Server, Socket } from "socket.io";

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer,
  {
    allowEIO3: true,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  }
  );
const rooms = new Map<string, Array<User>>();
const userRoom = new Map<string, string>();

io.on('connection', (socket) => {
  socket.emit('id', socket.id);

  socket.on('newRoom', () => {
    let roomId = Math.random().toString(36).substring(2, 5) + Math.random().toString(36).substring(2, 5);
    const existsRoom = rooms.has(roomId);
    if (existsRoom) {
      roomId = roomId+'1'
    }
    socket.emit('newRoom', roomId);
  })

  socket.on('listAllRooms', () => {
    console.log(rooms);
    socket.emit('listAllRooms', Array.from(rooms.keys()));
  })

  socket.on('changeDeckOfCards', (data) => {
    const room = userRoom.get(socket.id)!
    console.log('changeDeckOfCards')
    socket.to(room).emit('changeDeckOfCards', data);
  })

  socket.on('joinRoom', (data) => {
    socket.join(data.room)
    let joinedUser: User = {
      id: socket.id,
      isVoted: false,
      isAdmin: false,
      isSpectator: false
    }
    if (!rooms.has(data.room)) {
      joinedUser.isAdmin = true; 
      rooms.set(data.room, [joinedUser]);
    } else {
      const room = rooms.get(data.room) || []
      rooms.set(data.room, [...room, joinedUser]);
    }
    userRoom.set(socket.id, data.room)
    socket.to(data.room).emit('userJoined', joinedUser);
    socket.emit('roomDetail', rooms.get(data.room)?.map((user: User ) => {
        delete user.vote
        return user
      }));
  })

  socket.on("disconnect", () => {
    const roomToRemoveUser = userRoom.get(socket.id)
    if (roomToRemoveUser) {
      const room = rooms.get(roomToRemoveUser) || []
      rooms.set(roomToRemoveUser, room.filter(r => r.id !== socket.id))
      userRoom.delete(socket.id)
      if (rooms.get(roomToRemoveUser)!.length === 0) {
        rooms.delete(roomToRemoveUser)
      } else {
        socket.to(roomToRemoveUser).emit('userLeft', socket.id);
        allVoted(socket, roomToRemoveUser)
      }
    }
  })

  socket.on('vote', (data) => {
    const room = userRoom.get(socket.id)!
    const user = rooms.get(room)!.findIndex((u: User) => u.id === socket.id)
    let isVoted = true
    if (user != -1) {
      if (!data) {
        isVoted = false
      }
      rooms.get(room)![user].vote = data
      rooms.get(room)![user].isVoted = isVoted
    }
    socket.to(room).emit('voted', socket.id);
    socket.emit('voted', socket.id);
    allVoted(socket, room)
  })

  socket.on('showVotes', () => {
    const room = userRoom.get(socket.id)!
    const userIndex = rooms.get(room)!.findIndex(r => r.id === socket.id)
    const user = rooms.get(room)![userIndex]
    if (user.isAdmin) {
      showVotes(socket, room)
    }
  })

  socket.on('clear', () => {
    const room = userRoom.get(socket.id)!
    const userIndex = rooms.get(room)!.findIndex(r => r.id === socket.id)
    const user = rooms.get(room)![userIndex]
    if (user.isAdmin) {
      rooms[room] = rooms.get(room)!.map(r => {
        r.vote = null
        r.isVoted = false
        return r
      })
      socket.to(room).emit('clear', rooms.get(room));
      socket.emit('clear', rooms.get(room));
    }
    
  })

  socket.on('isSpectator', () => {
    try {
      const room = userRoom.get(socket.id)!
      const userIndex = rooms.get(room)!.findIndex(r => r.id === socket.id)
      const user = rooms.get(room)![userIndex]
      user.isSpectator = !user.isSpectator
      user.vote = null
      user.isVoted = false
      rooms.get(room)![userIndex] = user
      socket.to(room).emit('isSpectator', user);
      socket.emit('isSpectator', user);
    } catch (error) {
      console.log(error)
    }
  })

  const showVotes = (socket: Socket, room: string) => {
    if (rooms.get(room) === undefined) {
      return
    }
    const votes = rooms.get(room)!
    socket.to(room).emit('showVotes', votes);
    socket.emit('showVotes', votes);
    const average = sd(room)
    socket.to(room).emit('sd', average);
    socket.emit('sd', average);
  }

  const allVoted = (socket: Socket, room: string) => {
    if (rooms.get(room) === undefined) {
      return
    }
    const finded = rooms.get(room)!.findIndex((user: User) => user.isVoted === false && user.isSpectator === false)
    if (finded === -1) {
      showVotes(socket, room)
    }
  }

  const sd = (room: string) =>
  {
    if (rooms.get(room) === undefined) {
      return
    }
    const arr = rooms.get(room) || []
    const validVotes = arr.filter(user => user.isSpectator === false && parseFloat(user.vote!) > 0)

    const sum = validVotes.reduce((acc, user) => {
        const v = parseFloat(user.vote!) || 0
        acc += v
      return acc
    }, 0)
    const divider = validVotes.length
    if (divider === 0) {
      return { sd: 0, average: 0 }
    }
    const average = sum / divider
    const sumDistance = validVotes.reduce((acc, user) => {
      const v = parseFloat(user.vote!) || 0
      const d = Math.pow(v - average, 2)
      acc += d
      return acc
    }, 0)
    const mediaDistance = sumDistance / divider
    return { sd: Math.round( Math.sqrt(mediaDistance) * 100) / 100, average: Math.round(average) }
  }
})

httpServer.listen(3001)
console.log('started')