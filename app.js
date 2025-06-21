const { Socket } = require('dgram')
const express = require('express')
const app = express()

//socket.io setup
const http = require('http')
const server = http.createServer(app)
const { Server } = require('socket.io')
const io = new Server(server)

const players = {}
let twohece_ar;
let threehece_ar;

const rooms = {}


const fs = require('fs');

fs.readFile('public/three.txt', 'utf8', (err, data) => {
    if (err) {
        console.error('Dosya okunamadı:', err);
        return;
    }
    threehece_ar = data.split('\n');

});

fs.readFile('public/two.txt', 'utf8', (err, data) => {
    if (err) {
        console.error('Dosya okunamadı:', err);
        return;
    }
    twohece_ar = data.split('\n');

});

const wordData = fs.readFileSync('public/word.txt', 'utf8');
const words_ar = new Set(wordData.split('\n').map(w => w.trim().toLowerCase()));

app.use(express.static('public'))

// Ana sayfa ve oda kontrolü
app.get('/', (req, res) => {
    
    res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', (socket) => {
    console.log('odalar', rooms)
    console.log(players)
    socket.on("room_check", (data) => {
        const roomid = data.roomid;
        if (!rooms[roomid]) {
            
            socket.emit("room_error", { message: "Bu oda bulunamadı. Oda ID'sini kontrol ediniz." });
        }
    })
    //ODA OLUŞTUR
    socket.on("create_room", (data) => {
        const roomid = genroom();
        const avatar = data.avatar;
        console.log(roomid);
        players[socket.id] = {
            host: true,
            name: data.pname,
            room: roomid,
            avatar: avatar,
            socketId: socket.id
        };
        rooms[roomid] = {
            gamestate: "waiting",
            heceler: {},
            remainingTime: 0,
            randomtimer: 0,
            bombExploded: true,
            health: 2,
            timer: 10,
            elemination: 0,
            activeplayers: {},
            players: {
                [socket.id]: players[socket.id]
            },
            stack: [],
            countdownInterval: null,
            currentIndex: 0,
            currentAngle: 0,
            winner: 0,
            second: 0,
            third: 0
        }
        socket.join(roomid);
        const player = players[socket.id];
        socket.emit("room_created", { roomid, player, avatar });
    })


    //ODAYA KATIL
    socket.on("join_room", (data) => {
        const roomid = data.room1;
        const avatar = data.avatar;

        // Check if room exists
        if (!rooms[roomid]) {
            console.log(`Room ${roomid} does not exist`);
            socket.emit("room_error", { message: "Bu oda bulunamadı. Oda ID'sini kontrol ediniz." });
            return;
        }

        const roomPlayers = Object.values(players).filter(p => p.room === roomid);
        // Check if room exists

        players[socket.id] = {
            host: false,
            name: data.pname,
            room: roomid,
            avatar: avatar,
            socketId: socket.id
        };

        rooms[roomid].players[socket.id]= players[socket.id];
        // Add player to room

        socket.join(roomid)

        const player = players[socket.id];

        socket.emit("joined", { roomid, avatar, player, players: roomPlayers , timer: rooms[roomid].timer , health: rooms[roomid].health})
        // Notify other players in the room
        socket.to(roomid).emit("new_player_joined", { roomid, player, avatar })
        console.log(players)

    })

    socket.on('disconnect', () => {
        const player = players[socket.id];
        
        if (player) {
            const roomid = player.room;
            if(player.host === true){
                console.log(`Player ${socket.id} is host, deleting room ${roomid}`);
                // If the player is the host, delete the room
                if (rooms[roomid]) {
                    if(rooms[roomid].gamestate == "started"){
                        clearInterval(rooms[roomid].countdownInterval);
                    }
                    io.to(roomid).emit("player_disconnected", {
                    player: socket.id
                });
                    io.to(roomid).emit("host_disconnected", { player: player });
                    delete rooms[roomid];
                    // Clean up Socket.IO room
                    io.in(roomid).socketsLeave(roomid);
                    return;
                }
                return;
            }
            console.log(`Player disconnected: ${socket.id} from room ${roomid}`);
            delete rooms[roomid].players[socket.id];
            delete players[socket.id];
            if (rooms[roomid].gamestate == "started") {
                // If the game is started, we need to handle player disconnection
                console.log(`Player ${socket.id} disconnected from started game in room ${roomid}`);
                io.to(roomid).emit("restart_game");
                clearInterval(rooms[roomid].countdownInterval);
            }
            // Check if room is empty
            if (Object.keys(rooms[roomid].players).length === 0) {
                console.log(`Room ${roomid} is empty, deleting room...`);
                if(rooms[roomid].gamestate == "started"){
                    clearInterval(rooms[roomid].countdownInterval);
                }
                rooms[roomid].gamestate = "over";
                
                delete rooms[roomid];
                // Clean up Socket.IO room
                io.in(roomid).socketsLeave(roomid);
                
            } else {
                // Notify remaining players
                socket.to(roomid).emit("player_disconnected", {
                    player: socket.id
                });
            }
        } else {
            console.log(`Disconnected socket ${socket.id} was not in players list.`);
        }
    });
    ////////////////////////////////////////////////////////////////////////////////////////
    ///OYUN BÖLÜMÜ///
    socket.on("health_update",(data) => {
        const player = players[socket.id];
        const roomid = player.room;
        rooms[roomid].health  = data.health;
        
        io.to(roomid).emit("health_updated", { health: rooms[roomid].health  })
    })
    socket.on("timer_update",(data) => {
        const player = players[socket.id];
        const roomid = player.room;
        rooms[roomid].timer = data.timer;
        io.to(roomid).emit("timer_updated", { timer:rooms[roomid].timer })
    })
    socket.on("check_player_count",(data) => {
        if (players[socket.id].host !== true) {
            return socket.emit("error", { message: "Sadece oda sahibi oyunu başlatabilir." });
        }
        const roomid = data.roomid;
        if (!rooms[roomid]) {
            return socket.emit("error", { message: "Oda bulunamadı." });
        }
        io.to(roomid).emit("player_count", {
            count: Object.keys(rooms[roomid].players).length,
            roomid: roomid
        });
        
    })
    socket.on("start", (data) => {
        if (players[socket.id].host !== true) {
            return socket.emit("error", { message: "Sadece oda sahibi oyunu başlatabilir." });
        }
        const player = players[socket.id];
        const roomid = player.room;
        if (true) {
            rooms[roomid].health  = data.health;
            rooms[roomid].bombExploded = true;
            rooms[roomid].gamestate = "started";
            rooms[roomid].timer = data.timer;
            rooms[roomid].health = data.health;
            rooms[roomid].remainingTime = 0;
            rooms[roomid].randomtimer = 0;
            rooms[roomid].elemination = 0;
            rooms[roomid].currentIndex = 0;
            rooms[roomid].currentAngle = 0;
            rooms[roomid].activeplayers = {};
            rooms[roomid].heceler = {
                hece: "",
                hece_count: 0
            };
            rooms[roomid].stack = [];
            rooms[roomid].countdownInterval = null;

            initialize(roomid);

            start_bomb_timer(roomid);
        }
    })
    socket.on('play_again', (data) => {
        if (players[socket.id].host !== true) {
            return socket.emit("error", { message: "Sadece oda sahibi oyunu başlatabilir." });
        }
        const roomid = data.roomid;
        console.log("Play again requested for room:", roomid);
        
        // Check if socket is in the room
        if (!socket.rooms.has(roomid)) {
            console.log("Socket not in room:", roomid);
            return;
        }
        
        // Reset room state
        if (rooms[roomid]) {
            rooms[roomid].gamestate = "waiting";
            rooms[roomid].remainingTime = 0;
            rooms[roomid].randomtimer = 0;
            rooms[roomid].bombExploded = true;
            rooms[roomid].elemination = 0;
            
            rooms[roomid].currentIndex = 0;
            rooms[roomid].currentAngle = 0;
            rooms[roomid].activeplayers = {};
            rooms[roomid].heceler = {
                hece: "",
                hece_count: 0
            };
            rooms[roomid].stack = [];
            rooms[roomid].countdownInterval = null;
            // Emit restart to all clients in the room
            io.in(roomid).emit("restart");
            console.log("Restart event emitted to room:", roomid);
        } else {
            console.log("Room not found:", roomid);
        }
    })
    socket.on('randomhece', () => {
        
        const player = players[socket.id];
        const roomid = player.room;
        if(rooms[roomid].gamestate == "over" || rooms[roomid].gamestate == "waiting"){
            return 0;
        }
        randsyllable(roomid)

        io.to(roomid).emit("picked_hece", { heceler: rooms[roomid].heceler })
    })

    socket.on('answer', (data) => {
        
        const player = players[socket.id];
        const roomid = player.room;
        if(rooms[roomid].gamestate == "over" || rooms[roomid].gamestate == "waiting"){
            return 0;
        }
        
    })
    socket.on('submit_answer', (data) => {
        
        const player = players[socket.id];
        const roomid = player.room;
        if(rooms[roomid].gamestate == "over" || rooms[roomid].gamestate == "waiting"){
            return 0;
        }
        checkvalid(data.answer, roomid);


    })
    socket.on('answer_changed', (data) => {
        
        const player = players[socket.id];
        const roomid = player.room;
        if(rooms[roomid].gamestate == "over" || rooms[roomid].gamestate == "waiting"){
            return 0;
        }
        const answer = data.answer
        io.to(roomid).emit("update_answer", { answer: answer});

    })

    
    function initialize(roomid) {
        if(rooms[roomid].gamestate == "over" || rooms[roomid].gamestate == "waiting"){
            return 0;
        }
        rooms[roomid].activeplayers = Object.values(players)
        .filter(p => p.room === roomid ) 
        .map(p => ({
            name: p.name,
            health: rooms[roomid].health,
            room: p.room,
            avatar: p.avatar,
            socketid: p.socketId,
            eleminated: false
        }));
        console.log(`aktifler ${rooms[roomid].activeplayers} ve odaları`, rooms[roomid]);
        io.to(roomid).emit("started", { activeplayers: rooms[roomid].activeplayers });
        startround(roomid)
    }
    function startround(roomid) {
        if(rooms[roomid].gamestate == "over" || rooms[roomid].gamestate == "waiting"){
            return 0;
        }
        console.log("started")
        rooms[roomid].currentIndex = 0;
        rooms[roomid].currentAngle = 0;
        randsyllable(roomid)
        io.to(roomid).emit("first_spin", { index: rooms[roomid].currentIndex, angle: rooms[roomid].currentAngle })
    }

    function randsyllable(roomid) {
        if(rooms[roomid].gamestate == "over" || rooms[roomid].gamestate == "waiting"){
            return 0;
        }
        let random2index = Math.floor(Math.random() * twohece_ar.length);
        let random3index = Math.floor(Math.random() * threehece_ar.length);
        //let choose = Math.random(); 
        let choose = 0;
        if (choose <= 0.5) {
            rooms[roomid].heceler.hece = twohece_ar[random2index];
        } else {
            rooms[roomid].heceler.hece = threehece_ar[random3index];
        }

        rooms[roomid].heceler.hece_count = 0;
        io.to(roomid).emit("picked_hece", { hece: rooms[roomid].heceler.hece, hece_count: rooms[roomid].heceler.hece_count })
    }

    function start_bomb_timer(roomid) {
        if(rooms[roomid].gamestate == "over" || rooms[roomid].gamestate == "waiting"){
            return 0;
        }
        console.log("timer ", rooms[roomid].timer)
        rooms[roomid].randomtimer =  Math.round(Math.random() * 10) + Number(rooms[roomid].timer);  // 0-10 arası + timer → timer = timer+10
       

        rooms[roomid].remainingTime = rooms[roomid].randomtimer;
        rooms[roomid].bombExploded = false;


        rooms[roomid].countdownInterval = setInterval(() => {
            rooms[roomid].remainingTime --;
            console.log("***")
            console.log(`Time: ${rooms[roomid].remainingTime}`)
            

            // Geri sayım ekranını güncelle
            //display.textContent = remainingTime;
            // Patlatma zamanı
            if (rooms[roomid].remainingTime  <= 0 && !rooms[roomid].bombExploded ) {
                
                rooms[roomid].bombExploded = true;
                clearInterval(rooms[roomid].countdownInterval);
                console.log("BOMBA PATLADI!");
                io.to(roomid).emit("exploded");
                 // Call nextplayer first
                damageplayer(roomid);
                nextplayer(roomid);   // Then call damageplayer
                if( rooms[roomid].gamestate == "over"){
                    clearInterval(rooms[roomid].countdownInterval);
                    return 0;
                }
            }
        }, 1000);
    }
    function damageplayer(roomid) {
        if(rooms[roomid].gamestate == "over" || rooms[roomid].gamestate == "waiting"){
            return 0;
        }
        console.log("damage player")
        let currentIndex = rooms[roomid].currentIndex;
        
        let player = rooms[roomid].activeplayers[currentIndex];
        player.health = Number(player.health) - 1;
        rooms[roomid].heceler.hece_count++;
        if (player.health == '0') {
            rooms[roomid].stack.push(currentIndex);
            console.log("pushed", player.name)
            io.to(roomid).emit("updateActivePlayers", { currentIndex, player })
            rooms[roomid].activeplayers[currentIndex].eleminated = true;

            io.to(roomid).emit("damagePlayers", { currentIndex, player })
            rooms[roomid].elemination ++;


            if( rooms[roomid].activeplayers.length - rooms[roomid].elemination  == 1){
            let winner = findwinner(roomid);
            rooms[roomid].stack.push(winner);
            rooms[roomid].gamestate = "over";

            console.log("stack", rooms[roomid].stack)
            if(rooms[roomid].activeplayers.length == 2){
                let winner = rooms[roomid].stack.pop();
                let second = rooms[roomid].stack.pop();
                io.to(roomid).emit("gameover",{
                    winner: rooms[roomid].activeplayers[winner],
                    second: rooms[roomid].activeplayers[second]
                });
            }
            else{
                io.to(roomid).emit("gameover",{
                    winner: rooms[roomid].activeplayers[rooms[roomid].stack.pop()],
                    second: rooms[roomid].activeplayers[rooms[roomid].stack.pop()],
                    third: rooms[roomid].activeplayers[rooms[roomid].stack.pop()]
                });
            }
            console.log("-------------------")
            console.log("GAME OVER")
            // Reset game state
            rooms[roomid].remainingTime = 0;
            rooms[roomid].randomtimer = 0;
            rooms[roomid].bombExploded = true;
            rooms[roomid].elemination = 0;
            rooms[roomid].currentIndex = 0;
            rooms[roomid].currentAngle = 0;
            rooms[roomid].activeplayers = {};
            rooms[roomid].heceler = {
                hece: "",
                hece_count: 0
            };
            rooms[roomid].countdownInterval = null;
            rooms[roomid].stack = [];

        }   if(rooms[roomid].activeplayers.length - rooms[roomid].elemination  == 0){
            //1.yi bul
            rooms[roomid].winner = 0;
            io.emit("gameover",{winner: rooms[roomid].activeplayers[rooms[roomid].winner]});
            console.log("-------------------")
            console.log("GAME OVER")
            // Reset game state
            rooms[roomid].gamestate = "over";
            rooms[roomid].remainingTime = 0;
            rooms[roomid].randomtimer = 0;
            rooms[roomid].bombExploded = true;
            rooms[roomid].elemination = 0;
            rooms[roomid].currentIndex = 0;
            rooms[roomid].currentAngle = 0;
            rooms[roomid].activeplayers = {};
            rooms[roomid].heceler = {
                hece: "",
                hece_count: 0
            };
            rooms[roomid].countdownInterval = null;
            rooms[roomid].stack = [];
        }
        }
        else {
            io.to(roomid).emit("damagePlayers", { currentIndex, player });
        }
        rooms[roomid].currentIndex = currentIndex;
    }
    function findwinner(roomid){
        if (!rooms[roomid].activeplayers || rooms[roomid].activeplayers.length === 0) {
            console.log("No active players found");
            return 0;
        }
        let i = 0;
        while(i < rooms[roomid].activeplayers.length && rooms[roomid].activeplayers[i].eleminated === true){
            i++;
        }
        return i;
    }
    function nextplayer(roomid) {
        if(rooms[roomid].gamestate == "over" || rooms[roomid].gamestate == "waiting"){
            return 0;
        }
        console.log("nextplayer");
        const nextIndex = (rooms[roomid].currentIndex + 1) % rooms[roomid].activeplayers.length;
        rooms[roomid].currentIndex = nextIndex;
        if (rooms[roomid].heceler.hece_count == 0 || rooms[roomid].heceler.hece_count == 2) {
            randsyllable(roomid);
        }
        io.to(roomid).emit("nextplayer", { index: nextIndex })
        if(rooms[roomid].bombExploded == true){
            start_bomb_timer(roomid);
        }
    }
    function checkvalid(answer, roomid) {
        if(rooms[roomid].gamestate == "over" || rooms[roomid].gamestate == "waiting"){
            return 0;
        }
        let currentIndex = rooms[roomid].currentIndex; 
        let player = rooms[roomid].activeplayers[currentIndex];
        let valid = false;
        let includes = false;
        answer = answer.toLowerCase();
        io.to(roomid).emit("answer_visible", { answer });

        if (answer.includes(rooms[roomid].heceler.hece)) {
            includes = true;
            console.log("includes")
        }
        if (words_ar.has(answer)) {
            valid = true;
            console.log("in array")
        }
        if (!valid || !includes) {
            console.log("not valid")
            io.to(roomid).emit("not_valid", { currentIndex, player });
        }
        else {
            console.log("valid")
            checktimer(roomid);
            randsyllable(roomid);

            io.to(roomid).emit("valid", { currentIndex, player });
            nextplayer(roomid);
        }

    }

        function checktimer(roomid) {   
        if(rooms[roomid].gamestate == "over" || rooms[roomid].gamestate == "waiting"){
            return 0;
        }
        if (rooms[roomid].remainingTime < 5) {
            rooms[roomid].remainingTime += 6;
            console.log("Süre uzatıldı! Yeni süre:", rooms[roomid].remainingTime);
        }
    }
})

function genroom() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

server.listen(process.env.PORT || 3000, () => { // 3000 yerel geliştirme için fallback
    console.log(`example app listening on port ${process.env.PORT || 3000}`)
})

