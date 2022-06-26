interface User {
  id: string;
  vote?: string | null;
  isVoted: boolean;
  isAdmin: boolean;
  isSpectator: boolean;
}
interface ServerToClientEvents {
  roomDetail: (room: any) => void;
  userJoined: (user: User) => void;
  userLeft: (id: string) => void;
  voted: (id: string) => void;
  clear: () => void;
  id: (id: string) => void;
  showVotes: (data: any) => void;
  isSpectator: (data: User) => void;
}
interface ClientToServerEvents {
  joinRoom: (data: any) => void;
  vote: (vote: string) => void;
  clear: () => void;
  showVotes: () => void;
  isSpectator: () => void;
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
  console.log('connected');
  console.log(socket.id);
  socket.emit('id', socket.id);

  socket.on('joinRoom', (data) => {
    socket.join(data.room);
    let joinedUser: User = {
      id: socket.id,
      isVoted: false,
      isAdmin: false,
      isSpectator: false
    };
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
    console.log('joinRoom');
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
    console.log("disconnected")
  })

  socket.on('vote', (data) => {
    const room = userRoom.get(socket.id)!
    const user = rooms[room].findIndex(r => r.id === socket.id)
    if (user != -1) {
      rooms[room][user].vote = data
      rooms[room][user].isVoted = true
    }
    socket.to(room).emit('voted', socket.id);
    socket.emit('voted', socket.id);
    allVoted(socket, room)
  })

  socket.on('showVotes', () => {
    const room = userRoom.get(socket.id)!
    const userIndex = rooms[room].findIndex(r => r.id === socket.id)
    const user = rooms[room][userIndex]
    if (user.isAdmin) {
      showVotes(socket, room)
    }
  })

  socket.on('clear', () => {
    const room = userRoom.get(socket.id)!
    const userIndex = rooms[room].findIndex(r => r.id === socket.id)
    const user = rooms[room][userIndex]
    if (user.isAdmin) {
      rooms[room] = rooms[room].map(r => {
        r.vote = null
        r.isVoted = false
        return r
      })
      socket.emit('clear');
    }
    
  })

  socket.on('isSpectator', () => {
    const room = userRoom.get(socket.id)!
    const userIndex = rooms[room].findIndex(r => r.id === socket.id)
    const user = rooms[room][userIndex]
    user.isSpectator = !user.isSpectator
    rooms[room][userIndex] = user
    socket.emit('isSpectator', user);
  })

  const showVotes = (socket: Socket, room: string) => {
    if (rooms.get(room) === undefined) {
      return
    }
    const votes = rooms[room]
    socket.to(room).emit('showVotes', votes);
    socket.emit('showVotes', votes);
  }

  const allVoted = (socket: Socket, room: string) => {
    if (rooms.get(room) === undefined) {
      return
    }
    const finded = rooms[room].findIndex((user: User) => user.isVoted === false)
    if (finded === -1) {
      showVotes(socket, room)
    }
  }
})

httpServer.listen(3001)
console.log('started')