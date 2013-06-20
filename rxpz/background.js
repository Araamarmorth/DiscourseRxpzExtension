var animationFrames = 36;
var animationSpeed = 10; // ms
var canvas = document.getElementById('canvas');
var loggedInImage = document.getElementById('no_msg_img_html');
var canvasContext = canvas.getContext('2d');
var requestTimeout = 1000 * 2;  // 2 seconds
var rotation = 0;
var loadingAnimation = new LoadingAnimation();

// Legacy support for pre-event-pages.
var oldChromeVersion = !chrome.runtime;
var requestTimerId;

function getRxpzUrl() {
  return "https://discourse.rux-pizza.com/";
}

function getUnreadUrl() {
  // string and may be ignored/stripped.
  return getRxpzUrl() + "unread.json";
}

function getNewUrl() {
  // string and may be ignored/stripped.
  return getRxpzUrl() + "new.json";
}

function isRxpzUrl(url) {
  // Return whether the URL starts with the Rxpz discourse prefix.
  return url.indexOf(getRxpzUrl()) == 0;
}



// A "loading" animation displayed while we wait for the first response from
// Rxpz. This animates the badge text with a dot that cycles from left to
// right.
function LoadingAnimation() {
  this.timerId_ = 0;
  this.maxCount_ = 8;  // Total number of states in animation
  this.current_ = 0;  // Current state
  this.maxDot_ = 4;  // Max number of dots in animation
}

LoadingAnimation.prototype.paintFrame = function() {
  var text = "";
  for (var i = 0; i < this.maxDot_; i++) {
    text += (i == this.current_) ? "." : " ";
  }
  if (this.current_ >= this.maxDot_)
    text += "";

  chrome.browserAction.setBadgeText({text:text});
  this.current_++;
  if (this.current_ == this.maxCount_)
    this.current_ = 0;
}

LoadingAnimation.prototype.start = function() {
  if (this.timerId_)
    return;

  var self = this;
  this.timerId_ = window.setInterval(function() {
    self.paintFrame();
  }, 100);
}

LoadingAnimation.prototype.stop = function() {
  if (!this.timerId_)
    return;

  window.clearInterval(this.timerId_);
  this.timerId_ = 0;
}



function updateIcon() {
  if (!localStorage.hasOwnProperty('unreadCount')) {
    chrome.browserAction.setIcon({path:localStorage.disconnected_img});
    chrome.browserAction.setBadgeBackgroundColor({color:localStorage.disconnected_badge_color});
    chrome.browserAction.setBadgeText({text:"?"});
  }
  else if (localStorage.newCount != "0" || localStorage.unreadCount != "0") {
    chrome.browserAction.setIcon({path:localStorage.message_img});
    chrome.browserAction.setBadgeBackgroundColor({color:localStorage.message_badge_color});
	if (localStorage.counterDisplay == 0) {
		chrome.browserAction.setBadgeText({text:localStorage.newCount + "/" + localStorage.unreadCount});
	}
	else if (localStorage.counterDisplay == 1) {
		var nb_messages = parseInt(localStorage.newCount) + parseInt(localStorage.unreadCount)
		chrome.browserAction.setBadgeText({text:nb_messages.toString()});
	}
  }
  else {
    chrome.browserAction.setIcon({path: localStorage.no_message_img});
    chrome.browserAction.setBadgeText({text:""});
  }
}



function scheduleRequest() {
  console.log('scheduleRequest');
  var randomness = Math.random() * 2;
  var exponent = Math.pow(2, localStorage.requestFailureCount || 0);
  var multiplier = Math.max(randomness * exponent, 1);
  var delay = Math.min(multiplier * localStorage.pollIntervalMin, localStorage.pollIntervalMax);
  delay = Math.round(delay);
  console.log('Scheduling for: ' + delay);

  if (oldChromeVersion) {
    if (requestTimerId) {
      window.clearTimeout(requestTimerId);
    }
    requestTimerId = window.setTimeout(onAlarm, delay*60*1000);
  } else {
    console.log('Creating alarm');
    // Use a repeating alarm so that it fires again if there was a problem
    // setting the next alarm.
    chrome.alarms.create('refresh', {periodInMinutes: delay});
  }
}

// ajax stuff
function startRequest(params) {
  // Schedule request immediately. We want to be sure to reschedule, even in the
  // case where the extension process shuts down while this request is
  // outstanding.
  if (params && params.scheduleRequest) scheduleRequest();

  function stopLoadingAnimation() {
    if (params && params.showLoadingAnimation) loadingAnimation.stop();
  }

  if (params && params.showLoadingAnimation)
    loadingAnimation.start();
  
  getUnreadCount(
    function(count) {
      stopLoadingAnimation();
      updateUnreadCount(count);
    },
    function() {
      stopLoadingAnimation();
      delete localStorage.unreadCount;
      updateIcon();
    }
  );
  
   getNewCount(
    function(count) {
      stopLoadingAnimation();
      updateNewCount(count);
    },
    function() {
      stopLoadingAnimation();
      delete localStorage.newCount;
      updateIcon();
    }
  );
}


//The acutal function to get the number of message
function getUnreadCount(onSuccess, onError) {
  var xhr = new XMLHttpRequest();
  var abortTimerId = window.setTimeout(function() {
    console.warn('timeout as fuck');
	xhr.abort();  // synchronously calls onreadystatechange
  }, requestTimeout);

  function handleSuccess(count) {
    localStorage.requestFailureCount = 0;
    window.clearTimeout(abortTimerId);
    if (onSuccess)
      onSuccess(count);
  }

  var invokedErrorCallback = false;
  function handleError() {
	console.warn('Error');
    ++localStorage.requestFailureCount;
    window.clearTimeout(abortTimerId);
    if (onError && !invokedErrorCallback)
      onError();
    invokedErrorCallback = true;
  }

  try {
    xhr.onreadystatechange = function() {
		if (xhr.readyState == 1)
			return;
		if (xhr.readyState != 4)
			return;
		
      if (xhr.responseText) {
		var jsonResponse = JSON.parse(xhr.responseText);
		var message = jsonResponse.topic_list.topics.length;
		
        handleSuccess(message);
        return;
        
      }
	
      handleError();
    };

    xhr.onerror = function(error) {
      handleError();
    };

    xhr.open("GET", getUnreadUrl(), true);
	
    xhr.send(null);
  } catch(e) {
    console.error(chrome.i18n.getMessage("rxpzcheck_exception", e));
    handleError();
  }
}


function getNewCount(onSuccess, onError) {
  var xhr = new XMLHttpRequest();
  var abortTimerId = window.setTimeout(function() {
    console.warn('timeout as fuck');
	xhr.abort();  // synchronously calls onreadystatechange
  }, requestTimeout);

  function handleSuccess(count) {
    localStorage.requestFailureCount = 0;
    window.clearTimeout(abortTimerId);
    if (onSuccess)
      onSuccess(count);
  }

  var invokedErrorCallback = false;
  function handleError() {
	console.warn('Error');
    ++localStorage.requestFailureCount;
    window.clearTimeout(abortTimerId);
    if (onError && !invokedErrorCallback)
      onError();
    invokedErrorCallback = true;
  }

  try {
    xhr.onreadystatechange = function() {
		if (xhr.readyState == 1)
			return;
		if (xhr.readyState != 4)
			return;
		
      if (xhr.responseText) {
		var jsonResponse = JSON.parse(xhr.responseText);
		var message = jsonResponse.topic_list.topics.length;
		
        handleSuccess(message);
        return;
        
      }
	
      handleError();
    };

    xhr.onerror = function(error) {
      handleError();
    };

    xhr.open("GET", getNewUrl(), true);
	
    xhr.send(null);
  } catch(e) {
    console.error(chrome.i18n.getMessage("rxpzcheck_exception", e));
    handleError();
  }
}

function updateUnreadCount(count) {
  var changed = localStorage.unreadCount != count;
  localStorage.unreadCount = count;
  updateIcon();
  if (changed)
    animateFlip();
}

function updateNewCount(count) {
  var changed = localStorage.newCount != count;
  localStorage.newCount = count;
  updateIcon();
  if (changed)
    animateFlip();
}


function ease(x) {
  return (1-Math.sin(Math.PI/2+x*Math.PI))/2;
}

function animateFlip() {
  rotation += 1/animationFrames;
  drawIconAtRotation();

  if (rotation <= 1) {
    setTimeout(animateFlip, animationSpeed);
  } else {
    rotation = 0;
    updateIcon();
  }
}

function drawIconAtRotation() {
  canvasContext.save();
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  canvasContext.translate(
      Math.ceil(canvas.width/2),
      Math.ceil(canvas.height/2));
  canvasContext.rotate(2*Math.PI*ease(rotation));
  canvasContext.drawImage(loggedInImage,
      -Math.ceil(canvas.width/2),
      -Math.ceil(canvas.height/2));
  canvasContext.restore();

  chrome.browserAction.setIcon({imageData:canvasContext.getImageData(0, 0,
      canvas.width,canvas.height)});
}

function goToDiscourse() {
  console.log('Going to discourse..');
  chrome.tabs.getAllInWindow(undefined, function(tabs) {
    for (var i = 0, tab; tab = tabs[i]; i++) {
      if (tab.url && isRxpzUrl(tab.url)) {
        console.log('Found Rxpz tab: ' + tab.url + '. ' +
                    'Focusing and refreshing count...');
        chrome.tabs.update(tab.id, {selected: true});
        startRequest({scheduleRequest:false, showLoadingAnimation:false});
        return;
      }
    }
    console.log('Could not find Rxpz Discourse tab. Creating one...');
    chrome.tabs.create({url: getRxpzUrl()});
  });
}

function setNoOveride(property, value) {
	if (!localStorage.hasOwnProperty(property))
		localStorage[property] = value;
}

function setOptions() {
	//Set default icon
	setNoOveride('disconnected_img','grey_19.png');
	setNoOveride('no_message_img','black_19.png');
	setNoOveride('message_img','colored_19.png');
	
	//Set poll interval
	setNoOveride('pollIntervalMin', 1);//1 minute
	setNoOveride('pollIntervalMax', 10);
	
	//Set counter display
	setNoOveride('counterDisplay',0);
	setNoOveride('message_badge_color',[208, 0, 24, 255]);
	setNoOveride('disconnected_badge_color',[190, 190, 190, 230]);
}

function onInit() {
  console.log('onInit');
  localStorage.requestFailureCount = 0;  // used for exponential backoff
  
  setOptions();
  
  startRequest({scheduleRequest:true, showLoadingAnimation:true});
  if (!oldChromeVersion) {
    // TODO(mpcomplete): We should be able to remove this now, but leaving it
    // for a little while just to be sure the refresh alarm is working nicely.
    chrome.alarms.create('watchdog', {periodInMinutes:5});
  }
}

function onAlarm(alarm) {
  console.log('Got alarm', alarm);
  // |alarm| can be undefined because onAlarm also gets called from
  // window.setTimeout on old chrome versions.
  if (alarm && alarm.name == 'watchdog') {
    onWatchdog();
  } else {
    startRequest({scheduleRequest:true, showLoadingAnimation:false});
  }
}

function onWatchdog() {
  chrome.alarms.get('refresh', function(alarm) {
    if (alarm) {
      console.log('Refresh alarm exists. Yay.');
    } else {
      console.log('Refresh alarm doesn\'t exist!? ' +
                  'Refreshing now and rescheduling.');
      startRequest({scheduleRequest:true, showLoadingAnimation:false});
    }
  });
}

function installUpdate() {
	chrome.runtime.reload();
}

if (oldChromeVersion) {
  updateIcon();
  onInit();
} else {
  chrome.runtime.onInstalled.addListener(onInit);
  chrome.alarms.onAlarm.addListener(onAlarm);
  chrome.runtime.onUpdateAvailable.addListener(installUpdate);
}

var filters = {
  // TODO(aa): Cannot use urlPrefix because all the url fields lack the protocol
  // part. See crbug.com/140238.
  url: [{urlContains: getRxpzUrl().replace(/^https?\:\/\//, '')}]
};

function onNavigate(details) {
  if (details.url && isRxpzUrl(details.url)) {
    console.log('Recognized Discourse navigation to: ' + details.url + '.' +
                'Refreshing count...');
    startRequest({scheduleRequest:false, showLoadingAnimation:false});
  }
}
if (chrome.webNavigation && chrome.webNavigation.onDOMContentLoaded &&
    chrome.webNavigation.onReferenceFragmentUpdated) {
  chrome.webNavigation.onDOMContentLoaded.addListener(onNavigate, filters);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(
      onNavigate, filters);
} else {
  chrome.tabs.onUpdated.addListener(function(_, details) {
    onNavigate(details);
  });
}

chrome.browserAction.onClicked.addListener(goToDiscourse);

if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(function() {
    console.log('Starting browser... updating icon.');
    startRequest({scheduleRequest:false, showLoadingAnimation:false});
    updateIcon();
  });
} else {
  // This hack is needed because Chrome 22 does not persist browserAction icon
  // state, and also doesn't expose onStartup. So the icon always starts out in
  // wrong state. We don't actually use onStartup except as a clue that we're
  // in a version of Chrome that has this problem.
  chrome.windows.onCreated.addListener(function() {
    console.log('Window created... updating icon.');
    startRequest({scheduleRequest:false, showLoadingAnimation:false});
    updateIcon();
  });
}
