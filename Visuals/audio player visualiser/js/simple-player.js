document.addEventListener('DOMContentLoaded', function() {
const player = document.getElementById('play-pause-button');
const CurrentTime = document.getElementById('current-time');
const totalTime = document.getElementById('total-time');
const seekbar = document.getElementById('seek-bar');
const audio = new Audio("audio/polygonia.mp3");
let seeking = false;
// event handlers
// button events

player.onclick = function(){
    if (audio.paused) {
        audio.play();
    }else{audio.pause();}
}
    // audio events
audio.onloadedmetadata = function() {
    CurrentTime.innerHTML = formatTime(0);
    totalTime.innerHTML = formatTime(audio.duration);
    seekbar.max = Math.floor(audio.duration);
    seekbar.value = 0;
}
audio.oncanplaythrough= function() {
    seekbar.disabled = false;
}
audio.onplay= function() {
    player.src = "images/pause.svg";
}
audio.onpause= function() {
    player.src = "images/play.svg";
}
audio.ontimeupdate= function() {
    CurrentTime.innerHTML = formatTime(audio.currentTime);
    if (!seeking) 
        seekbar.value = Math.floor(audio.currentTime);
}
// seekbar events 
seekbar.oninput = function() {
    seeking = true;
}
seekbar.onchange = function() {
    audio.currentTime = seekbar.value;
    if (!audio.paused){
        audio.play();
    }
    seeking = false;
}



// takes total seconds (number) and returns a formatted string 
function formatTime(secs) {
    let hours = Math.floor(secs / 3600);
    let minutes = Math.floor((secs - (hours * 3600)) / 60);
    let seconds = Math.floor((secs - (hours * 3600)) - minutes * 60);
    if (hours < 10) {
        hours = "0" + hours;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }
    if (hours > 0) {
        if (minutes < 10) {
            minutes = "0" + minutes;
        }
        return hours + ":" + minutes + ":" + seconds;
    } else {
        return minutes + ":" + seconds;
    }
}
});