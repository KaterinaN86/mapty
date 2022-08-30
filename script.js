'use strict';

class Workout {
  date = new Date();
  id; //in the real world we usally use a library to define an id (this unique identifier is useful for when we want to filter an array of objects, it will enable us to easily identify the object we need)
  clicks = 0; //number of times a workout has been clicked

  constructor(coords, distance, duration) {
    this.coords = coords; //[latitude, longitude]
    this.duration = duration; //min
    this.distance = distance; //km

    this._createId();
  }

  _createId() {
    this.id = (Date.now() + '').slice(-10); //the last 10 digits of the timestamp of the moment the object was created
  }

  //we use this method to set the content of the workout popup
  _createWorkoutDescription() {
    //(because default prettier formatting will show the months each in a separate line)
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    //even though type is not defined in the Workout class, we never really create a Workout instance and both the classes that inherit this method have the type property
    // return `${this.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${
    //   this.type[0].toUpperCase() + this.type.slice(1)
    // } on ${this.months[this.date.getMonth()]} ${this.date.getDate()}`;

    this.description = `${this.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${
      this.constructor.name
    } on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
  }

  _click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence; //steps/min
    this._calcPace(); //calculating the pace as soon as an instance is created
    this._createWorkoutDescription();
  }

  _calcPace() {
    //adding a new property to the Running class
    this.pace = this.duration / this.distance; //min/km
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain; //meters
    this._calcSpeed(); //calculating the speed
    this._createWorkoutDescription();
  }

  _calcSpeed() {
    //adding a new property to the Cycling class
    this.speed = this.distance / (this.duration / 60); //km/h
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling);

/////////////////////////////////////////////////////////////////////////////////////
//APPLICATION DATA

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const modal = document.querySelector('.modal');
const overlay = document.querySelector('.overlay');
const modalCloseBtn = modal.querySelector('.btn--close-modal');
const workoutDetails = document.querySelector('.workout__details');
const formErrorMsg = document.querySelector('.form__error');
const editWorkoutEl = document.getElementById('edit');
const formCloseButton = document.querySelector('.form__btn');
let wrkEls = document.querySelectorAll('.workout');

const sortInput = document.querySelector('.sort__input');
const showAllBtn = document.querySelector('.sort__btn');
const deleteAllmodal = document.getElementById('delAllModal');
const deleteAllBtn = document.getElementById('delete');
const deleteModalClose = deleteAllmodal.querySelector('.btn--close-modal');

class App {
  //private class fields
  #map;
  //event that fires when the map is clicked
  #mapEvent;
  //all the created workouts
  #workouts = [];
  //zoom level on map
  #mapZoom = 17;

  //used for the marker on the polylines
  center;

  //all the markers on the map
  #markers = [];

  //used for polylines and their markers
  #editableLayers = new L.FeatureGroup();

  //used for markers
  #markersLG = L.layerGroup();

  //the id of the list element of the workout the user has clicked on
  #currentWorkout;

  //ture if a workout is being edited
  #editing = false;

  //polylines
  #polylines = [];

  //executed immediately when the page loads
  constructor() {
    this._getPosition(); //this method gets the clients current position using the geolocation API

    //get data from local storage
    this._getLocalStorage();

    //attaching event listeners to the DOM emelents
    form.addEventListener('submit', this._newWorkout.bind(this)); //when the form is submited the _newWorkout method is called. We need to bind the this keyword so that it will point to the object and not the form
    inputType.addEventListener('change', this._toggleElevationField); //called when the inpytType element's value is changed

    //we want to add a handler on the workout and because that element doesn't exist we need to perform event delegation. Because of this we add the listerner to the parent
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    modalCloseBtn.addEventListener('click', this._closeModal.bind(this));
    formCloseButton.addEventListener('click', this._removeForm);
    modal.addEventListener('submit', this._deleteWorkout.bind(this));
    sortInput.addEventListener('change', this._sortWorkouts.bind(this));
    showAllBtn.addEventListener('click', this._showAllWorkouts.bind(this));
    deleteAllBtn.addEventListener('click', this._showDeleteAll);
    deleteAllmodal.addEventListener(
      'submit',
      this._deleteAllWorkouts.bind(this)
    );
    deleteModalClose.addEventListener('click', this._closeDeleteModal);
  }

  //called in the construcor, gets the position of user and calls _loadMap
  _getPosition() {
    if (navigator.geolocation) {
      //testing for older browsers
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this), //called when coordinates are succesfully read
        function () {
          alert(`Could not get your position!`); //called when coordinates of the user's current location can not be read
        }
      );
    }
  }

  //shows the map on load using the current position
  _loadMap(position) {
    //gets called when location is successfully read
    //this callback takes an argument which gives us the user's position, the position object is defined by the leaflet library
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    console.log(latitude, longitude);
    console.log(`https://www.google.com/maps/@${latitude},${longitude}`);
    //this is the position object
    //GeolocationPosition
    // coords: GeolocationCoordinates {latitude: 41.0258804, longitude: 21.3172741, altitude: null, accuracy: 16.38, altitudeAccuracy: null, …}
    // timestamp: 1651174766786
    // [[Prototype]]: GeolocationPosition

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoom); //we make map constant and in this variable we save the map that was rendered in the HTML element with the map id, a div just before the end of the body

    // L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    //   maxZoom: 20,
    //   subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    // }).addTo(map); //google maps

    L.tileLayer('https://tile.osm.ch/switzerland/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#markersLG.addTo(this.#map);

    this.#workouts.forEach(wrk => this._renderMarker(wrk));

    this.#editableLayers.addTo(this.#map);

    // if (!polylines) return;

    // this._createPolylines(polylines);

    //let's give drawing a go
    this._enableDraw();

    //function called when the user clicks on the map
    this.#map.on('click', this._showForm.bind(this));

    //enables layer control
    let overlay = { markers: this.#markersLG, polylines: this.#editableLayers };
    L.control.layers(null, overlay).addTo(this.#map);
  }

  //gives us the workout object matching to the id of the selected workout
  _getCurrentWrk() {
    return this.#workouts.find(wrk => wrk.id === this.#currentWorkout);
  }

  _showForm(mapE) {
    // mapEvent is provided by leaflet
    form.classList.remove('hidden'); //make the form visible
    inputDistance.focus(); //when the form appears we immediately focus on this input field, for better user experience
    this.#mapEvent = mapE; //we initialize this private class field because we use it in another method

    // console.log(this.#currentWorkout);

    if (this.#currentWorkout && this.#editing) {
      const workout = this._getCurrentWrk();

      if (workout) {
        inputDistance.value = workout.distance;
        inputDuration.value = workout.duration;

        workout.type === 'running'
          ? (inputCadence.value = workout.cadence)
          : (inputElevation.value = workout.elevationGain);
      } else return;
    }
  }

  _removeForm() {
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        ''; //clear input fields

    //if we simply add back the hidden class there will be an animation when the form dissapears, the workouts will slide up

    form.style.display = 'none'; //to immediately remove form, without transition
    form.classList.add('hidden');

    //once we set the display property of the form we need to set it back to grid in order for showForm to work
    setTimeout(() => (form.style.display = 'grid'), 1000); //we set the display back to grid after the animation in the hidden class has finished (the transform property in the hidden class)

    // move the transition property out of the form class into a separate class:

    // .form--transition {
    //    transition: all 0.5s, transform 1ms;
    // }
    // And then in showForm and hideForm toggle that as well as hidden:

    // form.classList.toggle('hidden');
    // form.classList.toggle('form--transition');
    // And so when I open the form I remove the 'hidden' class and add the 'form--transition' class, and so the form grows into view. And when I close it, the 'hidden' class is added and the 'form--transition' class is removed, and so hiding it happens instantaneously.
  }

  //function that enables drawing
  _enableDraw() {
    //editableLayers is a FeatureGroup that will contain all of the polylines and their markers
    this.#map.addLayer(this.#editableLayers);

    const options = {
      position: 'topleft',
      draw: {
        polyline: {
          shapeOptions: {
            color: '#f357a1',
            weight: 10,
          },
        },
        // disable toolbar item by setting it to false
        polyline: true,
        circle: false, // Turns off this drawing toollayer
        polygon: false,
        marker: false,
        rectangle: false,
      },
      edit: {
        featureGroup: this.#editableLayers, //REQUIRED!!
        remove: true,
      },
    };

    // Initialise the draw control and pass it the FeatureGroup of editable layers
    let drawControl = new L.Control.Draw(options);
    this.#map.addControl(drawControl);

    this.#map.on(
      'draw:created',
      function (e) {
        // let type = e.layerType; this would be useful if there were other options for drawing
        let layer = e.layer;

        // if (type === 'polyline') {
        //   layer.bindPopup('A polyline!');
        // }

        const objs = Object.values(layer._latlngs);

        // objs.forEach(ob => console.log(Object.values(ob)));

        const polys = objs.map(ob => Object.values(ob));

        this.#polylines.push(polys);

        this.#editableLayers.addLayer(layer);

        //we mark the polylines at their center
        this.center = layer.getCenter();
        // console.log(this.center);

        // Calculating the distance of the polyline
        let tempLatLng = null;
        let totalDistance = 0.0;
        e.layer._latlngs.forEach(function (latlng) {
          if (tempLatLng == null) {
            tempLatLng = latlng;
            return;
          }

          totalDistance += tempLatLng.distanceTo(latlng);
          tempLatLng = latlng;
        });

        inputDistance.value = (totalDistance / 1000).toFixed(2);
      }.bind(this) //this is used to set the this special variable so it would point to the object and not the map
    );
    this._setLocalStorage();
  }

  //depending on the chosen option, cadence or elevation is shown
  _toggleElevationField() {
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  //called when the form is submited
  _newWorkout(e) {
    //this operator puts coma separated values in an array
    //using the rest operator to get an array from the comma separated arguments
    const validateInputs = (...inputs) =>
      inputs.every(value => Number.isFinite(value) && value !== 0); //returns true only if all of the elements of the array satisfy the condition

    //checks if all the inputs are positive
    const allPositive = (...inputs) => inputs.every(input => input > 0);

    //we use the hidden class to show the error mesaage, it is initially not displayed
    const showErrorMsg = e => {
      e.preventDefault();
      formErrorMsg.classList.remove('hidden');
      //the error message will be hidden again after 3 seconds
      setTimeout(() => formErrorMsg.classList.add('hidden'), 3000);
      return;
    };

    //get data from input fields
    const type = inputType.value; //we get the value from the HTML attribute of the element
    const distance = +inputDistance.value; //the input value is turned into a number
    const duration = +inputDuration.value;

    let { lat, lng } = this.#mapEvent.latlng; //destructuring

    //if center is calculated than the marker will be set in the center of the polyline
    if (this.center) {
      lat = this.center.lat;
      lng = this.center.lng;
    }

    //object with the info about the workout being created
    let workout;

    //validation is a very important part of getting data from user input

    if (type === 'running') {
      const cadence = +inputCadence.value;

      //guard caluse
      if (
        !validateInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return showErrorMsg(e);

      //creating a new workout object
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      //guard caluse
      if (
        !validateInputs(distance, duration, elevation) ||
        !allPositive(distance, duration) ||
        elevation === 0
      )
        return showErrorMsg(e);

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    e.preventDefault(); //perventing page reload which will make the marker dissapear

    //delegating functionality

    if (this.#currentWorkout && this.#editing) {
      //copies the values from one array to another
      workout.coords = this._getCurrentWrk().coords.slice(0);
      //making sure we keep the same id, like the coordinates before
      workout.id = this.#currentWorkout;
      //method that does the replacing
      this._replaceWorkout(workout);
      return;
    }

    //adding the workout to the array
    this.#workouts.push(workout);

    //delegating functionality to other methods
    this._renderMarker(workout);
    this._renderWorkout(this._createWorkoutHtml(workout));
    this._removeForm();

    //save all of the workouts in local storage
    this._setLocalStorage();
  }

  _createWorkoutHtml(workout) {
    let restOfHtml = '';

    //returns the string literal that will give us the element we want to insert after the beginning of the form HTML element
    const defineCommon = function () {
      return `<li class="workout workout--${workout.type}" data-id="${
        workout.id
      }">
     
      <h2 class="workout__title">${workout.description.slice(4)}
      <span class="btn--close-workout">❎</span></h2>
      <div class="workout__details">
      <div id="editSpan">
  
      </div>
      <span class="workout__value" style="  margin-left: auto;
      border: none;
      background: none;
      font-size: 1.3rem;
      font-weight: 500;
      cursor: pointer;" id="edit">
     EDIT</span>
  
        <span class="workout__icon">${workout.description.slice(0, 2)}</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
      <div class="workout__details">
      <span class="workout__icon">⚡️</span>`;
    };

    if (workout.type === 'running') {
      restOfHtml += `<span class="workout__value">${Number.parseFloat(
        workout.pace
      ).toFixed(1)}</span>
      <span class="workout__unit">min/km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">🦶🏼</span>
      <span class="workout__value">${workout.cadence}</span>
      <span class="workout__unit">spm</span>

    </div>
  </li>
`;
    }

    if (workout.type === 'cycling') {
      restOfHtml += `<span class="workout__value">${Number.parseFloat(
        workout.speed
      ).toFixed(1)}</span>
      <span class="workout__unit">km/h</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⛰</span>
      <span class="workout__value">${workout.elevationGain}</span>
      <span class="workout__unit">m</span>

  
    </div>
  </li>`;
    }

    return defineCommon() + restOfHtml;
  }

  //DOM manipulation to show the workouts data in a HTML list
  _renderWorkout(workoutHtml) {
    //with this the new list element will be a sibling to the form
    form.insertAdjacentHTML('afterend', workoutHtml);
    //reseting the center so we can use it for another polyline or polygon
    this.center = '';
  }

  //adding the marker on the map
  _renderMarker(workout) {
    let popup = L.popup({
      //I created this variable to store the popup
      closeOnClick: false,
      autoClose: false,
      maxWidth: 250,
      minWidth: 100,
      className: `${workout.type}-popup`,
    });

    //creating the marker
    let marker = L.marker(workout.coords);

    //adding the marker to the array
    this.#markers.push(marker);

    //we determain to which group do we add the marker
    if (!this.center) marker = marker.addTo(this.#markersLG);
    else marker = marker.addTo(this.#editableLayers); //polyline or polygon

    marker
      .bindPopup(popup)
      .setPopupContent(workout.description) //this method is on marker
      .bindTooltip(L.tooltip({ sticky: true })) //trying something with tooltip
      .setTooltipContent('Hey there')
      .openPopup();

    // setting an eventListener to a parent element of the popup
    //console.log(popup); // if you log the popup variable to the console you can see that it has this object in its properties

    // var overlay = { markers: layerGroup };
    // L.control.layers(null, overlay).addTo(this.#map);

    L.DomEvent.on(
      popup._contentNode,
      'click',
      this._highlightWorkout(workout.id)
    );
  }

  //replaces one object from the workouts array with a new one

  _replaceWorkout(workout) {
    // console.log(`Workouts before replacement`);

    // this.#workouts.forEach(wrk => console.log(wrk));

    //after this method has been executed none of the workouts will be selected for editing
    this.#currentWorkout = 0;
    this.#editing = false;

    //we use the index of the object in the array to do the replacement
    let workoutIndex = this.#workouts.findIndex(wrk => wrk.id === workout.id);
    this.#workouts[workoutIndex] = workout;

    //the HTML element that needs to be replaced
    let currWrkEl = '';

    //this is a global variable because it is used in other functions as well. It stores all of the HTMl elements that display a workout
    wrkEls = document.querySelectorAll('.workout');

    wrkEls.forEach(el => {
      if (el.dataset.id === workout.id) currWrkEl = el; //we find the one that needs to be replaced
    });

    //first we insert the HTML for the new workour right before the old one with the same id
    currWrkEl.insertAdjacentHTML(
      'beforebegin',
      this._createWorkoutHtml(workout)
    );

    //we remove the old one
    currWrkEl.remove();

    //we highlight the element that has been edited
    const highlight = this._highlightWorkout(workout.id);
    highlight();

    this._removeForm();

    this._setLocalStorage();
  }

  //opens the delete workout modal window
  _showModal() {
    modal.classList.remove('hiddenModal');
    overlay.classList.remove('hiddenModal');
  }
  //closes the modal
  _closeModal() {
    modal.classList.add('hiddenModal');
    overlay.classList.add('hiddenModal');
  }

  //opens the delete all workouts modal window
  _showDeleteAll(e) {
    e.preventDefault();
    deleteAllmodal.classList.remove('hiddenModal');
    overlay.classList.remove('hiddenModal');
  }
  //closes the modal
  _closeDeleteModal() {
    deleteAllmodal.classList.add('hiddenModal');
    overlay.classList.add('hiddenModal');
  }

  //delete the selected workout
  _deleteWorkout(e) {
    e.preventDefault();

    const option = e.target.querySelector('.modalForm__btn');

    //guard clause
    if (!option) return;

    let toRemove = '';

    wrkEls = document.querySelectorAll('.workout');

    for (const el of wrkEls) {
      if (el.dataset.id === this.#currentWorkout) toRemove = el;
    }

    // console.log(toRemove);
    //using the coordinates so we can remove the marker
    const coords = this._getCurrentWrk().coords;
    //removing the HTML
    toRemove.remove();
    //removing workout from workouts array
    this.#workouts = this.#workouts.filter(
      wrk => wrk.id !== this.#currentWorkout
    );

    let marker; //the marker of the deleted workout
    let lat, lng; //the coordinates of the marker
    this.#markers.forEach(m => {
      lat = m._latlng.lat;
      lng = m._latlng.lng;

      if (lat === coords[0] && lng === coords[1]) marker = m;
    }); //finding the marker

    //if the marker is conected to a polyline or polygon they need to be deleted too
    if (this.#editableLayers.hasLayer(marker))
      this.#editableLayers.removeLayer(marker);
    else this.#markersLG.removeLayer(marker); //removing the marker from the map

    this.#editableLayers.eachLayer(layer => {
      if (layer._latlngs) {
        const center = layer.getCenter();
        if (center.lat === coords[0] && center.lng === coords[1]) {
          this.#editableLayers.removeLayer(layer);
          this._removePoly(layer);
        }
      }
    });

    //removing the marker from the array of markers
    this.#markers = this.#markers.filter(m => +m._latlng.lat === coords[0]);

    this._closeModal();
    this.#currentWorkout = 0;

    this._setLocalStorage();
  }

  _removePoly(layer) {
    const objs = Object.values(layer._latlngs);

    // objs.forEach(ob => console.log(Object.values(ob)));

    const polys = objs.map(ob => Object.values(ob));

    this.#polylines = this.#polylines.filter(
      p => p.join('') !== polys.join('')
    );
  }

  //using closures to enable passing an argument in the callback
  _highlightWorkout(id) {
    return function (e) {
      wrkEls = document.querySelectorAll('.workout');
      //looping over the array of workout elements to find the matching id
      wrkEls.forEach(wrk => {
        //resetting background color for all workouts
        wrk.style.backgroundColor = '#42484d';
        if (wrk.dataset.id === id) wrk.style.backgroundColor = '#395d66';
        setTimeout(() => {
          if (wrk.dataset.id === id) wrk.style.backgroundColor = '#42484d';
        }, 5000);
      });
    };
  }

  _moveToPopup(e) {
    const moveTo = e.target.closest('.workout'); //it the user clicks on any child elemet of the list item with the class workout, the target will allways be the list item (we are moving up in the DOM)
    if (!moveTo) {
      return;
    }

    const workout = this.#workouts.find(
      work => work.id === moveTo.dataset.id //id of data attribute has to be the same as the objects id
    );

    this.#currentWorkout = workout.id;

    const highlight = this._highlightWorkout(this.#currentWorkout);
    highlight();

    if (e.target.id === 'edit') {
      this.#editing = true;
      this._showForm(this.#mapEvent);
    }

    // console.log(moveTo);
    // console.log(this.#workouts);
    //we use the find method to get the worout with the same id as the list item HTML element

    //preparing for the delete option
    if (e.target.classList.contains('btn--close-workout')) {
      this._showModal(e);
    }

    //positioning the map to the matching coordinates of the clicked workout
    this.#map.setView(workout.coords, this.#mapZoom, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // workout._click(); //increase the number of clicks on the object
    // // console.log(workout.clicks);
  }

  _sortWorkouts(e) {
    let sorted = this.#workouts;
    const sortBy = sortInput.value;
    if (sortBy === 'distance') sorted.sort((a, b) => a.distance - b.distance);
    if (sortBy === 'duration') sorted.sort((a, b) => a.duration - b.duration);

    if (sortBy === 'date') sorted.sort((a, b) => a.id - b.id);

    wrkEls = document.querySelectorAll('.workout');

    wrkEls.forEach(wrk => {
      if (wrk.classList.contains('workout')) wrk.remove();
    });

    sorted.forEach(workout =>
      this._renderWorkout(this._createWorkoutHtml(workout))
    );
  }

  _showAllWorkouts(e) {
    e.preventDefault();
    const latLngs = this.#workouts.map(wrk => wrk.coords);

    this.#map.fitBounds(latLngs);
  }

  _deleteAllWorkouts() {
    this.#workouts = [];
    //zoom level on map

    //all the markers on the map
    this.#markers = [];

    //used for polylines and their markers
    this.#editableLayers = new L.FeatureGroup();

    //used for markers
    this.#markersLG = L.layerGroup();

    //clear the polylines
    this.#polylines = [];

    this._setLocalStorage();
  }

  _setLocalStorage() {
    //localStorage is an API provided by the browser
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
    //the setItem method takes two string arguments. The first one is a key associated to the data we want to save, converted to a string
    //local storage is blocking and should only be used for small amounts of data

    if (this.#polylines) {
      const getCircularReplacer = () => {
        const seen = new WeakSet();
        return (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return;
            }
            seen.add(value);
          }
          return value;
        };
      };
      localStorage.setItem(
        'polylines',
        JSON.stringify(this.#polylines),
        getCircularReplacer()
      );
    }
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts')); //we retrieve the data from local storage using the key, the parse method converts the string back to an array of objects
    if (!data) return;
    this.#workouts = data;
    this.#workouts.forEach(wrk =>
      this._renderWorkout(this._createWorkoutHtml(wrk))
    );

    const polylines = JSON.parse(localStorage.getItem('polylines'));

    if (!polylines) return;

    this.#editableLayers = new L.FeatureGroup();
    polylines.forEach(poly => {
      this.#editableLayers.addLayer(
        L.polyline(poly, { color: '#f357a1', weight: 2 })
      );
    });

    this.#polylines = polylines;
  }
}

//creating the app object
const app = new App();

//if we want to store data from our application one way to do that is to use the browser's local storage. It will be linked to the URL in which we are using our application and it will be available after we close the page
//when a new workout is added the whole workouts array will be saved to local storage
//whenever the map loads, all of the previously entered workouts will be displayed on the map and the of the workouts data will be listed on sidebar

//local storage is an API that the browser provides. It is a simple key-value store and both of them are strings
//local storage is a small API and it is used only for a small amaunt of data, because it is blocking and it will slow down our application
