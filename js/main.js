'use strict';
var isChannelReady;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady=true;
var startbutton;
var localstartbutton=document.getElementById('loc');
localstartbutton.disabled = true;
var remoteattendbutton = document.getElementById('rem');
remoteattendbutton.disabled = true;
var keysender = false;


var pc_config = {'iceServers': [
    
{url:'stun:stun01.sipphone.com'},
{url:'stun:stun.ekiga.net'},
{url:'stun:stun.fwdnet.net'},
{url:'stun:stun.voipstunt.com'},
{url:'stun:stun.voxgratia.org'},
{url:'stun:stun.xten.com'},
{
  url: 'turn:107.167.183.18:3478?transport=udp',
  credential: 'A+mGoAwEYKvPeEY7O3+SAQedWF0=',
  username: '1416329110:41784574'
},
{
  url: 'turn:107.167.183.18:3478?transport=tcp',
  credential: 'A+mGoAwEYKvPeEY7O3+SAQedWF0=',
  username: '1416329110:41784574'
}
]};

var pc_constraints = {'optional': [{'DtlsSrtpKeyAgreement': true}]};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {'mandatory': {
  'OfferToReceiveAudio':true,
  'OfferToReceiveVideo':true }};

/////////////////////////////////////////////

var room = location.pathname.substring(1);
if (room === '') {
//  room = prompt('Enter room name:');
  room = 'foo';
} else {
  //
}

var socket = io.connect();

if (room !== '') {
  console.log('Create or join room', room);
  socket.emit('create or join', room);
}

socket.on('created', function (room){
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function (room){
  console.log('Room ' + room + ' is full');
}); 

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function (room){
  console.log('This peer has joined room ' + room);
  isChannelReady = true;
});

socket.on('log', function (array){
  console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message){
	console.log('Client sending message: ', message);
  // if (typeof message === 'object') {
  //   message = JSON.stringify(message);
  // }
  socket.emit('message', message);
}

socket.on('message', function (message){
  console.log('Client received message:', message);
  if (message === 'got user media') {
  	maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    remoteattendbutton.disabled = false;
    alert('press ANSWER to recieve incoming call');
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
    console.log('answering call');
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});


localstartbutton.onclick = function() {doCall();};
////////////////////////////////////////////////////

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

function handleUserMedia(stream) {
  console.log('Adding local stream.');
  localVideo.src = window.URL.createObjectURL(stream);
  localStream = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

function handleUserMediaError(error){
  console.log('getUserMedia error: ', error);
}

var constraints = {video: true,audio: true};
getUserMedia(constraints, handleUserMedia, handleUserMediaError);

console.log('Getting user media with constraints', constraints);



function maybeStart() {
  if (!isStarted && typeof localStream != 'undefined' && isChannelReady) {
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      localstartbutton.disabled=false;
      alert('press CALL to make a call');
    }
  }
}

window.onbeforeunload = function(e){
	sendMessage('bye');
}

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
  
  pc = new RTCPeerConnection(pc_config);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
   } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
      return;
  }
}

function handleIceCandidate(event) {
  console.log('handleIceCandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate});
  } else {
    console.log('End of candidates.');
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteVideo.src = window.URL.createObjectURL(event.stream);
  remoteStream = event.stream;
}

function handleCreateOfferError(event){
  console.log('createOffer() error: ', e);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);

  
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer(setLocalAndSendMessage, null, sdpConstraints);
}

function setLocalAndSendMessage(sessionDescription) {
  // Set Opus as the preferred codec in SDP if Opus is present.
  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message' , sessionDescription);
  sendMessage(sessionDescription);
}


function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteVideo.src = window.URL.createObjectURL(event.stream);
  remoteStream = event.stream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
//  console.log('Session terminated.');
  // stop();
  // isInitiator = false;
}

function stop() {
  isStarted = false;
  // isAudioMuted = false;
  // isVideoMuted = false;
  pc.close();
  pc = null;
}

///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('m=audio') !== -1) {
        mLineIndex = i;
        break;
      }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length-1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}

function sentKeyboardMessageToServer(KeyboardMessage){
  socket.emit('keyevent',KeyboardMessage)
  console.log("already send Keyboard Message To Server" );
}
socket.on('myevent',function(data){
  if(!keysender)
  {
    alert(data);
    arduino.config.flash.url = '/arduino/arduinojs.swf';

    arduino.config.debug.enabled = true; // useful for connection setup/troubleshooting

   //arduino.config.debug.flash.showUI = true; 
   // helps when fixing flash/onload() problems

    // configuring pins by type: digitalIn, digitalOut, pwmOut, servo: see arduino.config.pins array

    arduino.onload = function() {

      // Flash has loaded, now we're ready to connect to the proxy..

      arduino.connect('127.0.0.1', 'COM13', function() {
        
 arduino.writeDigitalPin(12, 1);
 arduino.writeDigitalPin(9, 1);
 arduino.writeDigitalPin(11, 0);
 arduino.writeDigitalPin(8, 0);
 alert("nothing happening");

 setTimeout(function() {  
  arduino.writeDigitalPin(12, 0);
 arduino.writeDigitalPin(9, 0);
 arduino.writeDigitalPin(11, 0);
 arduino.writeDigitalPin(8, 0); 

alert("stopping now");
 
 }

 ,1000);


      });

  }
}
});

function startRemoteControl(){
    $("body").bind('keyup', function(event){
      keysender = true;
        if (event.keyCode == 87){
            sentKeyboardMessageToServer("w");
            console.log("w pressed");
            //charPressed = "w";
        }
        else if (event.keyCode == 83){
            sentKeyboardMessageToServer("s");
            console.log("s pressed");

        }
        else if (event.keyCode == 65){
            sentKeyboardMessageToServer("a");
            console.log("a pressed");
        }
        else if (event.keyCode == 68){
            sentKeyboardMessageToServer("d");
            console.log("d pressed");
        }
        else if(event.keyCode == 88){
          sentKeyboardMessageToServer("x");
          console.log("x pressed");
        }
        else{
            console.log("please send actions 'w','s','a','d','h',x to other device.")
        }
    });
}
startRemoteControl();
