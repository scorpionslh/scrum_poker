interface ServerToClientEvents {
  roomDetail: (room: any) => void;
  userJoined: (id: string) => void;
  userLeft: (id: string) => void;
  voted: (id: string) => void;
  clear: () => void;
  showVotes: (data: any) => void;
}

interface ClientToServerEvents {
  hello: () => void;
  rooms: (data: any) => void;
  vote: (vote: string) => void;
  clear: () => void;
  showVotes: () => void;
}

import { Server, Socket } from "socket.io";

const io = new Server<ClientToServerEvents, ServerToClientEvents>();
const rooms = new Map<string, Array<string>>();
const userRoom = new Map<string, string>();
const userVote = new Map<string, string | null>();

io.on('connection', (socket) => {
  socket.on('rooms', (data) => {
    socket.join(data.room);
    if (!rooms.has(data.room)) {
      rooms.set(data.room, [socket.id]);
    } else {
      const room = rooms.get(data.room) || []
      rooms.set(data.room, [...room, socket.id])
    }
    userRoom.set(socket.id, data.room)
    socket.to(data.room).emit('userJoined', socket.id);
    socket.emit('roomDetail', rooms.get(data.room));
  })

  socket.on("disconnect", () => {
    const roomToRemoveUser = userRoom.get(socket.id)
    if (roomToRemoveUser) {
      const room = rooms.get(roomToRemoveUser) || []
      rooms.set(roomToRemoveUser, room.filter(id => id !== socket.id))
      userRoom.delete(socket.id)
      userVote.delete(socket.id)
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
    userVote.set(socket.id, data)
    socket.to(room).emit('voted', socket.id);
    socket.emit('voted', socket.id);
    allVoted(socket, room)
  })

  socket.on('showVotes', () => {
    const room = userRoom.get(socket.id)!
    showVotes(socket, room)
  })

  socket.on('clear', () => {
    const room = userRoom.get(socket.id)!
    rooms.get(room)!.map(id => userVote.delete(id))
    socket.emit('clear');
  })

  const showVotes = (socket: Socket, room: string) => {
    const votes = rooms.get(room)!.map(id => userVote.get(id))
    socket.to(room).emit('showVotes', votes);
    socket.emit('showVotes', votes);
  }

  const allVoted = (socket: Socket, room: string) => {
    const votes = rooms.get(room)!.map(id => userVote.get(id))
    const finded = votes.findIndex(vote => vote == undefined)
    if (finded === -1) {
      showVotes(socket, room)
    }
  }
})

io.listen(3001)
console.log('started')