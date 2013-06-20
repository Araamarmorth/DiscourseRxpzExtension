//Init icons

var icons = ["big_ears_19.png", "black_19.png", "colored_19.png", "grey_19.png", "sharp_19.png"];

function add_image_buttons(id, storage_property) {
	div = document.getElementById(id);
	for (var i=0,len=icons.length; i<len; i++) {
		var img_button = document.createElement("input");
		img_button.type = "image";
		img_button.value = storage_property
		img_button.src = icons[i];
		img_button.addEventListener('click', setImg);
		div.appendChild(img_button)
	}
}

add_image_buttons('disconnected_choice', 'disconnected_img');
add_image_buttons('no_message_choice', 'no_message_img');
add_image_buttons('message_choice', 'message_img');


var counter_display_choice = document.getElementsByName("counterDisplay")
for (var i=0,len=counter_display_choice.length; i<len; i++) {
	if (counter_display_choice[i].value == localStorage.counterDisplay)
		counter_display_choice[i].checked = true
	counter_display_choice[i].addEventListener('click', setCounterDisplay);
}


// Saves options to localStorage.

function setImg() {
	localStorage[this.value] = this.src;
	chrome.extension.getBackgroundPage().updateIcon()
}

function setCounterDisplay() {
	localStorage.counterDisplay = this.value;
	chrome.extension.getBackgroundPage().updateIcon()
}