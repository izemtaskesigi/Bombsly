// frontend.js

// Socket bağlantısını başta kuruyoruz
const socket = io();
// Math.floor(Math.random() * (max - min + 1)) + min;

const players = {}


const avatarList = [
    "a1.png",
    "a2.png",
    "a3.png",
    "a4.png",
    "a5.png",
    "a6.png",
    "a7.png",
    "a8.png"
];
const arrow = document.getElementById('arrow');
const inputarea = document.getElementById("answer");
const hecebox = document.getElementById("hecekutusu");
const bomb = document.getElementById("bomb");
const fire = document.getElementById("fire");
const pl = document.getElementById("alan3");
const how = document.getElementById("how");

let activePlayers = Object.values(players).map(p => ({ name: p.name }));
let timer; 
let health;
let element;

let gameover = false;
let myturn = false;

let counter = 0;
let currentIndex = 0;
let totalTurns = 2;
let anglePerPlayer;
let currentAngle = 0;
let prevlength;
let answered = false;
let lettercounter = 0;
let entered = false;
let hece_count = 0;
let room ;
let link ;
let randomIndex = -1;
let prevIndex = -1;
let third;
let second;
let winner;

// URL parametrelerini ve session'dan player adını al
const params = new URLSearchParams(window.location.search);
const roomid = params.get('roomid');
if(roomid != null){
socket.emit("room_check", { roomid: roomid });
}

let pname = params.get('pname') || sessionStorage.getItem('pname');

// View hangi ekranda olacağını belirler
let view = "create";

if (roomid && !pname) {
    view = "join"; // Başkası linkle gelmiş, adı yok → join
} else if (roomid && pname) {
    view = "team"; // Katıldıktan sonra takım seçimi
}

console.log("first View:", view);

// DOM yüklendiğinde
document.addEventListener("DOMContentLoaded", () => {
    showView(view);
});

function showView(id) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    console.log("view is =", id);
    document.getElementById(id).classList.add('active');
    view = id;
    handleViewChange(id);
}
function setRandomAvatar() {
    while(randomIndex == prevIndex ){
    randomIndex = Math.floor(Math.random() * avatarList.length);
    }
    prevIndex = randomIndex;
    const selectedAvatar = avatarList[randomIndex];
    return selectedAvatar;
}
socket.on("restart", () => {
    console.log("RESTART EVENT GELDİ");
    try {
        // Reset game state variables
        gameover = false;
        myturn = false;
        answered = false;
        lettercounter = 0;
        hece_count = 0;
        
        // Clear UI elements
        hecebox.innerText = "";
        inputarea.innerText = "";
        inputarea.style.display = "none";
        arrow.style.transform = `rotate(0deg)`;
        currentAngle = 0;
        counter = 0;
        currentIndex = 0;
        prevlength = 0;
        
        // Clear player elements
        document.querySelectorAll(".player").forEach(el => {
            el.classList.remove("shake", "true", "eleminated");
        });
        
        // Clear answer spans
        document.querySelectorAll(".answer_span").forEach(el => {
            el.innerText = "";
        });

        // Clear animations
        bomb.classList.remove("explode");
        fire.classList.remove("explode");
        document.querySelectorAll("#wrong").forEach(el => el.classList.remove("animate"));
        document.querySelectorAll("#right").forEach(el => el.classList.remove("animate"));
        
        // Show team view
        showView("team");
        view = "team";  
        console.log("Players before update:", players);
        
        addplayers(players);

        // Clear winner elements
        const winner = document.getElementById("winner");
        while (winner.firstChild) {
            winner.removeChild(winner.firstChild);
        }
        const second = document.getElementById("second");
        while (second.firstChild) {
            second.removeChild(second.firstChild);
        }
        const third = document.getElementById("third");
        while (third.firstChild) {
            third.removeChild(third.firstChild);
        }
        
        console.log("Restart completed successfully");
    } catch (e) {
        console.error("Restart event error:", e);
    }
})
function handleViewChange(view) {


    // Oda oluşturma (create sayfası)
    if (view == 'create') {
        let avatar = setRandomAvatar();
        document.getElementById("avatar1").src = "/images/avatars/" + avatar;
        const submitBtn = document.getElementById("submit");
        const randbtn = document.getElementById("rand1");
        randbtn.addEventListener("click", () => {
            avatar = setRandomAvatar();
            document.getElementById("avatar1").src = "/images/avatars/" + avatar;
        })

        if (submitBtn) {
            submitBtn.addEventListener("click", () => {
                const nameInput = document.getElementById("pname");
                pname = nameInput ? nameInput.value.trim() : "";

                if (pname) {
                    sessionStorage.setItem("pname", pname);
                    socket.emit("create_room", { pname, avatar });
                } else {
                    alert("Lütfen adınızı giriniz.");
                }
            });
        }
        if (how) {
            how.addEventListener("click", () => {
            //how to play viewini açıp videoyu oynat
            });
        }


    }

    // Odaya katılma (join sayfası)
    if (view == 'join') {
        let avatar = setRandomAvatar();
        document.getElementById("avatar2").src = "/images/avatars/" + avatar;
        let params = new URLSearchParams(window.location.search);
        let room1 = params.get('roomid');
        const joinBtn = document.getElementById("joinb");
       
        const randbtn = document.getElementById("rand2");
        randbtn.addEventListener("click", () => {
            avatar = setRandomAvatar();
            document.getElementById("avatar2").src = "/images/avatars/" + avatar;
        })

        if (joinBtn) {
            joinBtn.addEventListener("click", () => {
                const nameInput = document.getElementById("pname2");
                pname = nameInput ? nameInput.value.trim() : "";
                console.log(pname);
                if (pname) {
                    sessionStorage.setItem("pname", pname);
                    console.log(room1);
                    socket.emit("join_room", { room1, pname, avatar });
                } else {
                    alert("Lütfen adınızı giriniz.");
                }
            });
        }

    }

    // team selection
    if (view == 'team') {
        room = new URLSearchParams(window.location.search).get('roomid');
        link = `${window.location.origin}?roomid=${room}`;
        health = document.getElementById("health").innerText;
        timer = document.getElementById("timer").innerText;
        document.querySelector("body").style.zoom = 0.8;
        
        
        element = "circle";
        const roomlinkEl = document.getElementById("roomlink");
    if (roomlinkEl) {
        roomlinkEl.innerText = link;

        const roombutton = document.getElementById("roombutton");
        roombutton.removeEventListener("click", handleCopyRoomLink);
        roombutton.addEventListener("click", handleCopyRoomLink);
    }

    const upH = document.getElementById("up-h");
    upH.removeEventListener("click", handleHealthUp);
    upH.addEventListener("click", handleHealthUp);

    const downH = document.getElementById("down-h");
    downH.removeEventListener("click", handleHealthDown);
    downH.addEventListener("click", handleHealthDown);

    const upR = document.getElementById("up-r");
    upR.removeEventListener("click", handleTimerUp);
    upR.addEventListener("click", handleTimerUp);

    const downR = document.getElementById("down-r");
    downR.removeEventListener("click", handleTimerDown);
    downR.addEventListener("click", handleTimerDown);

    const startBtn = document.getElementById("start");
    startBtn.removeEventListener("click", handleStartGame);
    startBtn.addEventListener("click", handleStartGame);
}

        
    
    if (view == 'game') {
        document.querySelector("body").style.zoom = 0.75;
        element = "circle3";
        addplayers(players);
    }
    if (view == 'end') {
        document.querySelector("body").style.zoom = 0.75;
        const f = document.getElementById("winner");
        const icon1 = document.createElement("img");
        const name1 = document.createElement("span");
        const num1 = document.createElement("span");
        num1.className = "number";
        name1.innerText = winner.name;
        icon1.src = "/images/avatars/"+ winner.avatar;
        f.appendChild(num1);
        f.appendChild(icon1)
        f.appendChild(name1)
        const s = document.getElementById("second");
        const icon2 = document.createElement("img");
        const name2 = document.createElement("span");
        const num2 = document.createElement("span");
        name2.innerText = second.name;
        icon2.src = "/images/avatars/"+ second.avatar;
        num2.className = "number";
        s.appendChild(num2);
        s.appendChild(icon2)
        s.appendChild(name2)
        
        const t = document.getElementById("third");
        
        const icon3 = document.createElement("img");
        const name3 = document.createElement("span");
        const num3 = document.createElement("span");
        num3.className = "number";
        num1.innerText = "1.";
        num2.innerText = "2.";
        num3.innerText = "3.";
        
        icon3.classList.add("endimg");
        icon2.classList.add("endimg");
        icon1.classList.add("endimg");

        if(third != undefined){
        name3.innerText = third.name;
        icon3.src = "/images/avatars/"+ third.avatar;
        t.appendChild(num3);
        t.appendChild(icon3)
        t.appendChild(name3)
        
        }
        name1.classList.add("playername2")
        name2.classList.add("playername2")
        name3.classList.add("playername2")
        
        
        if(third == undefined){
            icon3.src = "/images/a-1.png";
            name3.innerText = "Bilinmiyor";
        }
        const again = document.getElementById("again");
        if (again) {
            again.addEventListener("click", () => {
                console.log("AGAIN CLICKED");
                console.log("Current room:", room);
                socket.emit("play_again", { roomid: room });
            });
        }
    }
    if(view == "error"){
        const homeButton = document.querySelector('.home-button');
        if (homeButton) {
            homeButton.addEventListener('click', () => {
                showView("create");
            });
        }
    }
}



function update_players(player) {

    players[player.socketId] = {
        name: player.name,
        room: player.room,
        words: player.words || [],
        avatar: player.avatar,
        socketId: player.socketId
    };
    console.log("-----"+ players);
    addplayers(players);


}
function addplayers(players) {
    const player_name_ar = Object.values(players).map(p => ({
        name: p.name,
        avatar: p.avatar,
        socketid: p.socketId
    }));
    const circle = document.getElementById(element);

    document.querySelectorAll(".player").forEach(el => el.remove());

    const total = player_name_ar.length;
    const radius = 340;

    const circleCenterX = circle.offsetWidth / 2; // Daire merkezi X
    const circleCenterY = circle.offsetHeight / 2.1; // Daire merkezi Y

    player_name_ar.forEach((player, i) => {
        const angleRad = (2 * Math.PI / total) * i - Math.PI / 2; // Radyan cinsinden açı



        // Konum hesaplama
        const x = radius * Math.cos(angleRad);
        const y = radius * Math.sin(angleRad);

        // Element oluştur
        const playere = document.createElement("div");
        playere.className = "player";

        const playername = document.createElement("span");
        playername.className = "playername";

        const answer_box = document.createElement("span");
        playere.appendChild(answer_box);
        answer_box.classList = "answerbox";

        const player_icon = document.createElement("img");
        playere.appendChild(player_icon);

        const wrong = document.createElement("img");
        
        wrong.src = "/images/wrong.png";
        wrong.id = "wrong";

        const right = document.createElement("img");
        
        right.src = "/images/rightt.png";
        right.id = "right";

        const player_answer = document.createElement("span");
        player_answer.id = player.name + "+answer";
        player_answer.classList = "answer_span";
        player_answer.innerText = "";
        answer_box.appendChild(player_answer);


        const player_health_bar = document.createElement("span");
        player_health_bar.classList = "kalpbarı";
        playere.appendChild(player_health_bar);

        if (view == "game") {

            for (let i = 0; i < health; i++) {
                const player_health = document.createElement("img");
                player_health.src = "images/heart2.png";
                player_health.classList = "kalp";
                player_health_bar.appendChild(player_health);

            }

        }

        playere.id = player.socketid;

        player_icon.src = "/images/avatars/" + player.avatar;
        playername.innerText = player.name;
        playere.appendChild(playername);
        playere.appendChild(wrong);
        playere.appendChild(right);



        player_icon.className = "avatar2"


        // Pozisyonlama (ortaya göre ayarla)
        playere.style.position = "absolute";
        playere.style.left = `${circleCenterX + x - 40}px`; // 45=player genişliği/2
        playere.style.top = `${circleCenterY + y}px`; // merkezlemek için

        circle.appendChild(playere);
    })
}


function spinToPlayer(index) {
    console.log("spinToPlayer", index);
    console.log("currentIndex", currentIndex);
    if (gameover) {
        console.log("OYUN BİTTİ");
        return;
    }
    if (activePlayers[index].eleminated && !gameover) {
        spinToPlayer((index + 1) % activePlayers.length, currentAngle);
        return;
    }
    const steps = (index - currentIndex + activePlayers.length) % activePlayers.length;
    currentAngle = currentAngle + (steps * anglePerPlayer);
    currentIndex = index;
    prevlength = activePlayers.length;
    //başta tur atsın diye
    if (counter == 0) {
        arrow.style.transform = `rotate(${currentAngle + 360 - 45}deg)`;
        currentAngle += 360;
        counter++;
    }
    else {
        arrow.style.transform = `rotate(${currentAngle - 45}deg)`;
    }

    console.log("Spinning to:", activePlayers[index].name);
    answer(index);

    socket.emit("answer", { activePlayers, index });
}
function nextPlayer() {

    const nextIndex = (currentIndex + 1) % activePlayers.length;
    spinToPlayer(nextIndex);
}

function answer(index) {

    if (activePlayers[index].socketid == socket.id) {
        console.log("answer visible");
        makevisible();
    }
}
function getsyllable(hece) {
    hecebox.innerText = hece;
}

function makevisible() {
    console.log("makevisible");
    inputarea.innerText = "";
    inputarea.style.display = "flex";
    myturn = true;
}
function makenonvisible() {
    console.log("makenonvisible");
    inputarea.innerText = "";
    inputarea.style.display = "none";
    myturn = false;
}

socket.on("health_updated", (data) => {
    health = data.health;
    document.getElementById("health").innerText = health;
})
socket.on("timer_updated", (data) => {
    timer = data.timer;   
    document.getElementById("timer").innerText = timer;
})

socket.on("started", (data) => {
    activePlayers = data.activeplayers;
    anglePerPlayer = 360 / activePlayers.length;
    console.log("active players", activePlayers);
    console.log("angle per player", anglePerPlayer);
    console.log("showgamee gelmek üzere");
    showView('game');
})

socket.on("first_spin", (data) => {
    console.log("first spin geldi");
    const index = data.index;
    spinToPlayer(index);
})

socket.on("nextplayer", (data) => {
    console.log("nextplayer geldi");
    const index = data.index;
    nextPlayer(index);
})
socket.on("not_valid", (data) => {
    const currentPlayer = activePlayers[currentIndex];
    const player_element = document.getElementById(currentPlayer.socketid);
    player_element.classList.add("shake");
    myturn = true;
    inputarea.innerText = "";
    lettercounter = 0;
    inputarea.classList.add("shake");
    setTimeout(() => {
        player_element.classList.remove("shake");
        inputarea.classList.remove("shake");
    }, 500);
    
})

socket.on("valid", (data) => {

    const currentPlayer = activePlayers[currentIndex];
    const player_element = document.getElementById(currentPlayer.socketid);

    player_element.classList.add("true");
    makenonvisible();
    lettercounter = 0;
    const right = player_element.querySelector("#right");
    
    right.classList.add("animate");
    setTimeout(() => {
        right.classList.remove("animate");
        player_element.classList.remove("true");
    }, 370);
    
})
socket.on("exploded", (data) => {
    myturn = false;
    makenonvisible();
    lettercounter = 0;
    console.log("BOOM!");
    bomb.classList.add("explode");
    fire.classList.add("explode");
    const currentPlayer = activePlayers[currentIndex];
    const player_element = document.getElementById(currentPlayer.socketid);
    const wrong = player_element.querySelector("#wrong");
    wrong.classList.add("animate");
    setTimeout(() => {
        wrong.classList.remove("animate");
    }, 370);
    setTimeout(() => {
        bomb.classList.remove("explode");
        fire.classList.remove("explode");
    }, 700);
    
})
socket.on("updateActivePlayers", (data) => {
    console.log("update playersa girdi")
    const index = data.currentIndex;
    console.log("index", index);
    const player = data.player;
    console.log("player", player.name);
    let id = player.socketid;
    document.getElementById(id).classList.add('eleminated');
    activePlayers[index].eleminated = true;
    
})
socket.on("gameover", (data) => {
    gameover = true;
    winner = data.winner;
    second = data.second;
    if(data.third != undefined){
    third = data.third;
    }
    showView("end");
})
socket.on("damagePlayers", (data) => {

    const player = data.player;
    let id = player.socketid;
    const player_element = document.getElementById(id);
    player_element.classList.add("shake");

    setTimeout(() => {
        player_element.classList.remove("shake");
        
    }, 1500);
    const healthbar = player_element.childNodes[2];
    const child = healthbar.childNodes[0];
    if (child) {
        child.remove();
    }
    if (player.socketid == socket.id) {
        makenonvisible();
    }
    write("£");
})

// Socket Event Listeners
socket.on("picked_hece", (data) => {
    console.log("picked hece geldi");
    const hece = data.hece;
    hece_count = data.hece_count;

    getsyllable(hece);

});

socket.on("answer_visible", (data) => {
    let name = activePlayers[currentIndex].name;
    const answerarea = document.getElementById(name + "+answer");
    answerarea.innerText = data.answer;

})

socket.on("joined", (data) => {
    const room = data.roomid;
    const timer = data.timer;
    const health = data.health;
    if(timer != document.getElementById("timer").innerText){
        document.getElementById("timer").innerText = timer;
       
    }
    if(health != document.getElementById("health").innerText){
        document.getElementById("health").innerText = health;
    }
    console.log("Joined room:", room);
    showView('team');
    view = 'team';
    data.players.forEach(p => update_players(p));
    update_players(data.player);

});

socket.on("new_player_joined", (data) => {
    update_players(data.player);

})

socket.on("player_disconnected", (data) => {
    delete players[data.player];


    addplayers(players); // Bu sayede circle güncellenir

    console.log("updated");

})
socket.on("host_disconnected", (data) => {
    console.log("Host disconnected, removing player:", data.player);
    window.history.pushState({}, '', '/');
    showView("error");
    addplayers(players);
    gameover = false;
    myturn = false;
    answered = false;
    lettercounter = 0;
    hece_count = 0;
    
    // Clear UI elements
    hecebox.innerText = "";
    inputarea.innerText = "";
    inputarea.style.display = "none";
    arrow.style.transform = `rotate(0deg)`;
    currentAngle = 0;
    counter = 0;
    currentIndex = 0;
    prevlength = 0;
    
    // Clear player elements
    document.querySelectorAll(".player").forEach(el => {
        el.classList.remove("shake", "true", "eleminated");
    });
    
    // Clear answer spans
    document.querySelectorAll(".answer_span").forEach(el => {
        el.innerText = "";
    });

    // Clear animations
    bomb.classList.remove("explode");
    fire.classList.remove("explode");
    document.querySelectorAll("#wrong").forEach(el => el.classList.remove("animate"));
    document.querySelectorAll("#right").forEach(el => el.classList.remove("animate"));


    // Clear winner elements
    const winner = document.getElementById("winner");
    while (winner.firstChild) {
        winner.removeChild(winner.firstChild);
    }
    const second = document.getElementById("second");
    while (second.firstChild) {
        second.removeChild(second.firstChild);
    }
    const third = document.getElementById("third");
    while (third.firstChild) {
        third.removeChild(third.firstChild);
    }
    
    console.log("Restart completed successfully");
    

})

socket.on("room_created", (data) => {


    const newUrl = `${window.location.origin}?roomid=${data.roomid}`;

    window.history.pushState({ path: newUrl }, '', newUrl);
    showView('team');
    view = 'team';
    update_players(data.player);

});

socket.on("room_error", (data) => {
    window.history.pushState({}, '', '/'); // URL'yi değiştir
    showView("error");
    // Redirect to home page after error
});

document.addEventListener("keyup", (e) => {
    if (gameover) return;
    if (!myturn) {
        console.log("myturn false");
        return;
    }
    if (lettercounter < 13) {
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { // sadece karakter tuşları
            inputarea.innerText += e.key;
            lettercounter++;
            socket.emit("answer_changed", { answer: inputarea.innerText});

        }
        else if (e.code === "Space") {
            inputarea.innerHTML += "&nbsp;";
            lettercounter++;
            socket.emit("answer_changed", { answer: inputarea.innerText});
        }
    }
    else{
        console.log("LETTER COUNT EXCEEDED",lettercounter);
    }
})
document.addEventListener("keydown", (e) => {
    if (gameover) return;
    if (!myturn) {
        console.log("myturn false");
        return;
    }
    if (e.code == "Backspace") {
        if (lettercounter > 0) {
            lettercounter--;
            let text = inputarea.innerText;
            text = text.slice(0, -1); // sondan bir karakter sil
            inputarea.innerText = text; // silinmiş metni tekrar yaz
            socket.emit("answer_changed", { answer: inputarea.innerText});

        }
    }
    else if (e.code == "Enter") {
        if (!entered) {
            //enter
            let name = activePlayers[currentIndex].name;
            const answerarea = document.getElementById(name + "+answer");
            answerarea.innerText = inputarea.innerText;
            const answer = inputarea.innerText;
            socket.emit("submit_answer", { answer: answer });
        }
    }

})
socket.on("update_answer",(data) => {
    const answer = data.answer;
    write(answer);
})
function write(answer){
    let name = activePlayers[currentIndex].name;
    const answerarea = document.getElementById(name + "+answer");
    if(answer != "£")
    {
        answerarea.innerText = answer;
    }
    else{
        let text = answerarea.innerText;
        text = `<s>${text}</s>`;
        answerarea.innerHTML = text;
    }
    
}

// Handler Fonksiyonları
function handleCopyRoomLink() {
    navigator.clipboard.writeText(link)
        .catch((err) => console.error("Error copying: ", err));
}

function handleHealthUp() {
    if (Number(health) < '5') {
        health = Number(health) + 1;
        document.getElementById("health").innerText = health;
        socket.emit("health_update", { health: health, roomid: room })
    }
}

function handleHealthDown() {
    console.log("dh");
    if (Number(health) > 1) {
        health = Number(health) - 1;
        document.getElementById("health").innerText = health;
        socket.emit("health_update", { health: health, roomid: room });
    }
}

function handleTimerUp() {
    console.log("up");
    if (Number(timer) < 60) {
        timer = Number(timer) + 5;
        document.getElementById("timer").innerText = timer;
        socket.emit("timer_update", { timer: timer, roomid: room });
    }
}

function handleTimerDown() {
    console.log("down");
    if (Number(timer) > 10) {
        timer = Number(timer) - 5;
        document.getElementById("timer").innerText = timer;
        socket.emit("timer_update", { timer: timer, roomid: room });
    }
}

function handleStartGame() {
 socket.emit("check_player_count", { roomid: room});    
}

socket.on("player_count", (data) => {
    if (data.count <= 1) {
        alert("En az 2 oyuncu olmalı!");
        return;
    }
    else{
         socket.emit("start", { timer: timer, health: health, roomid: room });
    }
    
})
socket.on("restart_game", () => {
socket.emit("play_again", { roomid: room });
})



/* to do 
    - 2 farklı room oluşduğunda okun dönme açısı bozuluyor, bunu düzelt
    - backenddeki heceleri roomlara göre ayır 
    */
