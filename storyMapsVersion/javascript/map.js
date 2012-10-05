dojo.require("esri.map");
dojo.require("esri.dijit.Legend");
dojo.require("esri.dijit.Scalebar");
dojo.require("esri.arcgis.utils");
dojo.require("esri.IdentityManager");
dojo.require("dijit.dijit"); // optimize: load dijit layer
dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("esri.dijit.TimeSlider");
dojo.require("dojox.fx");

var urlObject, _maps = [], timeoutComplete = false, timeSlider, _timeProperties = [], timeInterface = false, _thumbIndexes = [], mapsLoaded = 0, mapsReady = false, isPlaying = false, cm, mapExtent;

var toBoolean = function (str) {
  switch (str.toLowerCase ()) {
    case "true":
      return true;
    case "false":
      return false;
    default:
      return true;
  }
};

function initMap(){
	patchID();
      
      if(configOptions.geometryserviceurl && location.protocol === "https:"){
        configOptions.geometryserviceurl = configOptions.geometryserviceurl.replace('http:','https:');
      }
      esri.config.defaults.geometryService = new esri.tasks.GeometryService(configOptions.geometryserviceurl);  
      


      if(!configOptions.sharingurl){
        configOptions.sharingurl = location.protocol + '//' + location.host + "/sharing/content/items";
      }
      esri.arcgis.utils.arcgisUrl = configOptions.sharingurl;
       
      if(!configOptions.proxyurl){   
        configOptions.proxyurl = location.protocol + '//' + location.host + "/sharing/proxy";
      }

      esri.config.defaults.io.proxyUrl =  configOptions.proxyurl;

      esri.config.defaults.io.alwaysUseProxy = false;
      
      urlObject = esri.urlToObject(document.location.href);
      urlObject.query = urlObject.query || {};
      
      if(urlObject.query.title){
        configOptions.title = urlObject.query.title;
      }
      if(urlObject.query.subtitle){
        configOptions.subtitle = urlObject.query.subtitle;
      }
	  if(urlObject.query.description){
        configOptions.description = urlObject.query.description;
      }
	  if(urlObject.query.displayDescription){
        configOptions.displayDescription = toBoolean(urlObject.query.displayDescription);
      }
	  if(urlObject.query.displayLegend){
        configOptions.displayLegend = toBoolean(urlObject.query.displayLegend);
      }
	  if(urlObject.query.loop){
        configOptions.loop = toBoolean(urlObject.query.loop);
      }
	  if(urlObject.query.syncMaps){
        configOptions.syncMaps = toBoolean(urlObject.query.syncMaps);
      }
      if(urlObject.query.webmap){
		  if (dojo.isArray(urlObject.query.webmap) == false){
        	configOptions.webmaps[0].id = urlObject.query.webmap;
		  }
		  else{
			dojo.forEach(urlObject.query.webmap,function(webmap,i){
			  configOptions.webmaps[i] = {"id": webmap};
			  if(urlObject.query.tabTitle){
				  if (configOptions.tabTitles[i] == null || configOptions.tabTitles[i].title == ""){
					  if (dojo.isArray(urlObject.query.tabTitle) == false){
						if (i == 0){
							configOptions.tabTitles[0] = {"title": urlObject.query.tabTitle} || {"title": ""};
						}
						else{
							configOptions.tabTitles[i] = {"title": ""};
						}
					  }
					  else{
						configOptions.tabTitles[i] = {"title": urlObject.query.tabTitle[i]} || {"title": ""};
					  }
				  }
			  }
			  else{
				  configOptions.tabTitles[i] = {"title": ""};
			  }
			});
		  }	
      } 
      if(urlObject.query.bingMapsKey){
        configOptions.bingmapskey = urlObject.query.bingMapsKey;      
      }
	  
	createMap();
}

function createMap(){
	dojo.forEach(configOptions.webmaps, function(arg,i){
		
		if(configOptions.tabTitles[i] == null){
			configOptions.tabTitles[i] = {"title": ""};
		}
		
		dojo.place("<div id='mapDiv"+i+"' class='map'></div>",dojo.byId('mapPane'),"last");
		if (configOptions.webmaps.length > 1){
			dojo.place("<h3 id='title"+i+"' class='mapTitle'></h3>",dojo.byId('descriptionPanel'),"last");
			dojo.place("<div id='tab"+i+"' class='tab' onclick='changeMap("+i+")'><p id='tabText"+i+"' class='tabText'></p></div>",dojo.byId('tabArea'),"last");
			dojo.addClass(dojo.byId("tab0"),"selected");
		}
		dojo.place("<div id='description"+i+"' class='description'></div>",dojo.byId('descriptionPanel'),"last");
		dojo.place("<div id='legend"+i+"' class='legend'></div>",dojo.byId('legendPanel'),"last");
		
		var mapDeferred = esri.arcgis.utils.createMap(arg.id, "mapDiv"+i, {
			mapOptions: {
				slider: true,
				nav: false,
				wrapAround180:true
			},
			ignorePopups:false,
			bingMapsKey: configOptions.bingmapskey
		});
		
		mapDeferred.addCallback(function (response) {
			
			var map = response.map
			_maps[i] = map;
			
			dojo.connect(map,'onClick',stopTime);
			dojo.connect(map,'onExtentChange',syncExtents)
			dojo.connect(map,"onUpdateEnd",function(){
				mapLoaded();
				playAnimation();
			});
			
			if (i == 0){
				document.title = configOptions.title|| response.itemInfo.item.title || "";
        		dojo.byId("title").innerHTML = configOptions.title ||response.itemInfo.item.title || "";
        		dojo.byId("subtitle").innerHTML = configOptions.subtitle|| response.itemInfo.item.snippet || "";
				dojo.byId("description0").innerHTML = configOptions.description|| response.itemInfo.item.description || "";
				if (configOptions.webmaps.length > 1){
					dojo.byId("title0").innerHTML = response.itemInfo.item.title || "";
					dojo.byId("description0").innerHTML = response.itemInfo.item.description || "";
				}
			}
			if (configOptions.webmaps.length > 1){
				dojo.byId("tabText"+i).innerHTML = configOptions.tabTitles[i].title || response.itemInfo.item.title || "";
				dojo.byId("title"+i).innerHTML = response.itemInfo.item.title || "";
				dojo.byId("description"+i).innerHTML = response.itemInfo.item.description || "";
			}
			
			var layers = response.itemInfo.itemData.operationalLayers;
			
			if(response.itemInfo.itemData.widgets && response.itemInfo.itemData.widgets.timeSlider){
				_timeProperties[i] =  response.itemInfo.itemData.widgets.timeSlider.properties;
				timeInterface = true;
			}
			addTabsAndTime();
			
			if(map.loaded){
          		initUI(layers,i,map);
        	}
        	else{
          		dojo.connect(map,"onLoad",function(){
					initUI(layers,i,map);
				});
        
			}		
        	//resize the map when the browser resizes
			dojo.connect(dijit.byId('mapPane'), 'resize', function(){
				dojo.forEach(_maps,function(map){
					if (map != null){
						map.resize();
					}
				});
				centerTimeDisplay();
			});
       
	  	});

      mapDeferred.addErrback(function (error) {
          alert("Unable to create map: " + " " + dojo.toJson(error.message));
		  mapsLoaded = configOptions.webmaps.length - 1;
		  mapLoaded();
		  dojo.destroy(dojo.byId("tab"+i));
		  if (i==0){
		      alert("Please choose another tab to begin");
		  }
      });
		
	});
	
	setupLayout();
}


function initUI(layers,index,map) {
	//add chrome theme for popup
    dojo.addClass(map.infoWindow.domNode, "chrome");
    //add the scalebar 
    var scalebar = new esri.dijit.Scalebar({
		map: map,
        scalebarUnit:"english" //metric or english
    }); 

    var layerInfo = buildLayersList(layers);      

    if(layerInfo.length > 0){
		var legendDijit = new esri.dijit.Legend({
			map:map,
			layerInfos:layerInfo
		},"legend"+index);
        legendDijit.startup();
    }
    else{
        dojo.byId("legend"+index).innerHTML = "";
    }
	if (timeSlider == null){
		if(_timeProperties[index] != null){
			if(cm == null){
				cm = index;
			}
			
			var startTime = _timeProperties[index].startTime;
			var endTime = _timeProperties[index].endTime;
		    var fullTimeExtent = new esri.TimeExtent(new Date(startTime), new Date(endTime));
			map.setTimeExtent(fullTimeExtent);
			
			timeSlider = new esri.dijit.TimeSlider({
				style: "width: 100%;",
				loop: configOptions.loop
		  	}, dojo.byId("timeSliderDiv"));
			
			map.setTimeSlider(timeSlider);
			
			timeSlider.setThumbCount(_timeProperties[index].thumbCount);
		    timeSlider.setThumbMovingRate(_timeProperties[index].thumbMovingRate);
			
			if(_timeProperties[index].numberOfStops){
				timeSlider.createTimeStopsByCount(fullTimeExtent,_timeProperties[index].numberOfStops);
		  	}
			else{
				timeSlider.createTimeStopsByTimeInterval(fullTimeExtent,_timeProperties[index].timeStopInterval.interval,_timeProperties[index].timeStopInterval.units);
		  	}
			
		  	if(timeSlider.thumbCount == 2){
				timeSlider.setThumbIndexes([0,1]);
		  	}
			
			dojo.connect(timeSlider,'onTimeExtentChange',function(timeExtent){
				
				var timeCon = dojo.query("#timeSliderDiv > table > tbody > tr > td");
				dojo.place("<img id='playPause' class='timeControl' src='images/playIcon.png' alt='' onClick='animate()'>",timeCon[0],'last');
				dojo.place("<img id='prev' class='timeControl' src='images/prevIcon.png' alt='' onClick='prevTime()'>",timeCon[2],'last');
				dojo.place("<img id='next' class='timeControl' src='images/nextIcon.png' alt='' onClick='nextTime()'>",timeCon[3],'last');
				
				_thumbIndexes[cm] = timeSlider.thumbIndexes
				waitForLoad();
				var timeString; 
				if(_timeProperties[cm].timeStopInterval !== undefined){
					switch(_timeProperties[cm].timeStopInterval.units){   
						case 'esriTimeUnitsCenturies':	
			  				datePattern = 'yyyy G'
			  				break;          
						case 'esriTimeUnitsDecades':
			  				datePattern = 'yyyy'
			  				break;  
			 			case 'esriTimeUnitsYears':
			  				datePattern = 'MMMM yyyy'
			 				 break;
						case 'esriTimeUnitsWeeks':	 
			  				datePattern = 'MMMM d, yyyy'
			  				break;
						case 'esriTimeUnitsDays':
			  				datePattern = 'MMMM d, yyyy'
			  				break;        
						case 'esriTimeUnitsHours':
			  				datePattern = 'h:m:s.SSS a'
			  				break;
						case 'esriTimeUnitsMilliseconds':
			  				datePattern = 'h:m:s.SSS a'
			  				break;          
						case 'esriTimeUnitsMinutes':
			  				datePattern = 'h:m:s.SSS a'
			 				break;          
						case 'esriTimeUnitsMonths':
			  				datePattern = 'MMMM d, y'
			  				break;          
						case 'esriTimeUnitsSeconds':
			  				datePattern = 'h:m:s.SSS a'
			  				break;          
		  			}
		   			timeString = formatDate(timeExtent.startTime,datePattern) + " to " + formatDate(timeExtent.endTime,datePattern);
		  		}
		  		else{
					timeString = formatDate(timeExtent.endTime,'MMMM d,yyyy');
		  		}
		
			dojo.byId('timeDisplay').innerHTML = timeString;
			
			centerTimeDisplay();
				
		  });
			
			timeSlider.startup();
			
			dojo.forEach(dojo.query(".timeControl"),function(qry){
				dojo.style(qry,"display","block");
			});
			//dojo.place("<div id='timeSliderBlind'></div>",dojo.byId("timeSliderArea"),"last");
			dojo.style(dojo.byId("timeSliderBlind"),"opacity", "0.8");
			
			dojo.connect(dojo.byId("next"),'onmousedown',function(){
				dojo.byId("next").setAttribute("src","images/nextIconDark.png");
			});
			dojo.connect(dojo.byId("next"),"onmouseup",function(){
				dojo.byId("next").setAttribute("src","images/nextIcon.png");
			});
			dojo.connect(dojo.byId("prev"),'onmousedown',function(){
				dojo.byId("prev").setAttribute("src","images/prevIconDark.png");
			});
			dojo.connect(dojo.byId("prev"),"onmouseup",function(){
				dojo.byId("prev").setAttribute("src","images/prevIcon.png");
			});
			dojo.connect(dojo.byId("playPause"),'onmousedown',function(){
				if (dojo.attr(dojo.byId("playPause"),"src") == "images/playIcon.png"){
					dojo.byId("playPause").setAttribute("src","images/playIconDark.png");
				}
				else{
					dojo.byId("playPause").setAttribute("src","images/pauseIconDark.png");
				}
			});
		}
	}
}





function buildLayersList(layers){
        //layers  arg is  response.itemInfo.itemData.operationalLayers;
        var layerInfos = [];
        dojo.forEach(layers, function(mapLayer, index){
          var layerInfo = {};
          if (mapLayer.featureCollection && mapLayer.type !== "CSV") {
            if (mapLayer.featureCollection.showLegend === true) {
              dojo.forEach(mapLayer.featureCollection.layers, function(fcMapLayer){
                if (fcMapLayer.showLegend !== false) {
                  layerInfo = {
                    "layer": fcMapLayer.layerObject,
                    "title": mapLayer.title,
                    "defaultSymbol": false
                  };
                  if (mapLayer.featureCollection.layers.length > 1) {
                    layerInfo.title += " - " + fcMapLayer.layerDefinition.name;
                  }
                  layerInfos.push(layerInfo);
                }
              });
            }
          } else if (mapLayer.showLegend !== false) {
            layerInfo = {
              "layer": mapLayer.layerObject,
              "title": mapLayer.title,
              "defaultSymbol": false
            };
            //does it have layers too? If so check to see if showLegend is false
            if (mapLayer.layers) {
              var hideLayers = dojo.map(dojo.filter(mapLayer.layers, function(lyr){
                return (lyr.showLegend === false);
              }), function(lyr){
                return lyr.id
              });
              if (hideLayers.length) {
                layerInfo.hideLayers = hideLayers;
              }
            }
            layerInfos.push(layerInfo);
          }
        });
        return layerInfos;
      }

function formatDate(date,datePattern){
	return dojo.date.locale.format(date, {
    	selector: 'date',
        datePattern: datePattern
	});
}

function mapLoaded(){
	var timeout = setTimeout("timeoutError()",10000);
	if (mapsLoaded <= configOptions.webmaps.length){
		if (mapsLoaded == configOptions.webmaps.length - 1){
			if (configOptions.webmaps.length == 1){
				if (_timeProperties[0] != null){
					dojo.style(dojo.byId("tabArea"),"height","0px");
					dojo.style(dojo.byId("banner"),"height","165px");
				}
			}
			dojo.forEach(_maps,function(map,i){
				if (i != 0){
					dojo.fadeOut({
						node: dojo.byId("mapDiv"+i),
						duration: 300
					}).play();
				}
				else{
					dojo.style(dojo.byId("legend"+i),"display","block");
					dojo.style(dojo.byId("description"+i),"display","block");
					if (configOptions.webmaps.length > 1){
						dojo.style(dojo.byId("title"+i),"display","block");
					}
				}
			});
			dojo.place(dojo.byId('mapDiv0'),dojo.byId('mapPane'),'last');
			dojo.fadeOut({
				node: dojo.byId("mapBlind"),
				duration: 500
			}).play();
			var t = setTimeout("dojo.style(dojo.byId('mapBlind'),'display','none')",500);
			if (_timeProperties[0] == null){
				dojo.fadeOut({
					node: dojo.byId("timeDisplay"),
					duration: 1
				}).play();
				dojo.style(dojo.byId('timeDisplay'),'z-index','0');
			}
			else{
				dojo.fadeOut({
					node: dojo.byId("timeSliderBlind"),
					duration: 500
				}).play();
				var t = setTimeout("dojo.style(dojo.byId('timeSliderBlind'),'display','none')",500);
			}
			mapsReady = true;
			mapsLoaded++
			dijit.byId("mainWindow").layout();
			cm = 0;
			syncExtents();
			esri.hide(dojo.byId("loadingCon"));
		}
		else{
			mapsLoaded++
		}
	}
}


function animate(){
	if(_timeProperties[cm] != null){
		if (isPlaying == false){
			isPlaying = true;
			playAnimation();
			dojo.byId("playPause").setAttribute("src","images/pauseIcon.png");
		}
		else{
			isPlaying = false;
			timeSlider.pause();
			dojo.byId("playPause").setAttribute("src","images/playIcon.png");
		}
	}
}

function stopTime(){
	if (timeSlider){
		isPlaying = false;
		timeSlider.pause();
		dojo.byId("playPause").setAttribute("src","images/playIcon.png");
	}
}

function playAnimation(){
	if(_timeProperties[cm] != null){
		if (isPlaying == true){
			timeSlider.play();
		}
	}
}

function waitForLoad(){
	if(_timeProperties[cm] != null){
		timeSlider.pause();
	}
}

function prevTime(){
	if(_timeProperties[cm] != null){
		isPlaying = false;
		timeSlider.pause();
		dojo.byId("playPause").setAttribute("src","images/playIcon.png");
		timeSlider.previous();
	}	
}

function syncExtents(){
	if (configOptions.syncMaps == true){
		if (_maps[cm]){
			if (_maps[cm].extent != mapExtent){
				mapExtent = _maps[cm].extent;
				dojo.forEach(_maps,function(map,i){
					if (i != cm){
						if(map){
							map.setExtent(mapExtent);
						}
					}
				});
			}
		}
	}
}

function patchID() {  //patch id manager for use in apps.arcgis.com
       esri.id._isIdProvider = function(server, resource) {
       // server and resource are assumed one of portal domains
 
       var i = -1, j = -1;
 
       dojo.forEach(this._gwDomains, function(domain, idx) {
         if (i === -1 && domain.regex.test(server)) {
           i = idx;
         }
         if (j === -1 && domain.regex.test(resource)) {
           j = idx;
         }
       });
 
       var retVal = false;
   
       if (i > -1 && j > -1) {
         if (i === 0 || i === 4) {
           if (j === 0 || j === 4) {
             retVal = true;
           }
         }
         else if (i === 1) {
           if (j === 1 || j === 2) {
             retVal = true;
           }
         }
         else if (i === 2) {
           if (j === 2) {
             retVal = true;
           }
         }
         else if (i === 3) {
           if (j === 3) {
             retVal = true;
           }
         }
       }
 
       return retVal;
     };    
    }
	
	function timeoutError(){
		if (timeoutComplete == false && mapsLoaded < configOptions.webmaps.length - 1){
			timeoutComplete = true;
			mapsLoaded = configOptions.webmaps.length - 1;
			mapLoaded();
		}
	}