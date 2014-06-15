/*\
title: $:/core/modules/widgets/import-widget.js
type: application/javascript
module-type: widget


\*/

(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var widget = require("$:/core/modules/widgets/widget.js").widget;

var importWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
	this.addEventListeners([
	{type: "tw-import-tiddlers", handler: "handleImportTiddlersEvent"}
	]);
};

/*
Inherit from the base widget class
*/
importWidget.prototype = new widget();

/*
Render this widget into the DOM
*/
importWidget.prototype.render = function(parent,nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	this.renderChildren(parent,nextSibling);
};


/*
Compute the internal state of the widget
*/
importWidget.prototype.execute = function() {
	var self=this; this.report=this.reporter();
	var IMPORTED="Imported",NOTIMPORTED="Not Imported";
	// Get our parameters
	var conflictRules = this.getAttribute("conflictRules");
	conflictRules = conflictRules && conflictRules.length > 0 ? conflictRules.toLowerCase().split(",") : [];
	console.log(conflictRules);
	var importrules = this.getAttribute("importRules");
	importrules = importrules && importrules.length > 0 ? importrules.split(";") : [];

	var rules={
	 "plugins": function(tiddler,existing){
	 if(tiddler.hasField("plugin-type") && tiddler.hasField("version") && existing.hasField("plugin-type") && existing.hasField("version"))
		// Reject the incoming plugin if it is older
		var status=$tw.utils.checkVersions(existing.fields.version,tiddler.fields.version) ? false : true;

		return {status:status , category : [tiddler.fields.title,status ? IMPORTED : NOTIMPORTED, "Pugins"] }
	  },
     "newestwins" :
	 function(tiddler,existing){ status=tiddler.fields.modified > existing.fields.modified;
	 return {status:status , category : [tiddler.fields.title,status ? IMPORTED : NOTIMPORTED, status? "Newer than existing" :"Newer already exist" ] } },
     "oldestwins" :
     function(tiddler,existing){ status=tiddler.fields.modified < existing.fields.modified
     return {status:status , category : [tiddler.fields.title,status ? IMPORTED : NOTIMPORTED, "Older"] }},
     "longertextwins" :
     function(tiddler,existing){ return tiddler.fields.text.length > existing.fields.text.length },
	 "includetags" : function(tagsArr){
	                 return function(tiddler){ var result=true;
					        for(var i=0; result && i<tagsArr.length;i++){ result = tiddler.hasTag(tagsArr[i]);
							console.log("Tag ",tagsArr[i],result);}
							return result;
							}  },
	"excludetags" : function(tagsArr){ return ! this.includetags(tagsArr) },
    };


    this.conflictRules=[ rules.plugins,this.ignoreIdenticalTiddlers ]; //ignore Identical the very first rule
	this.importRules=[];
	//construct the import rules array
	importrules.forEach(
	    function(rule) { rule=rule.split(":");
		                 self.importRules.push( rules[rule[0].toLowerCase()]( rule[1].split(",") ) ) }
						);
	//construct the conflict rules array
    for(var i=0; i<conflictRules.length; i++) this.conflictRules.push( rules[conflictRules[i]] );

	// Construct the child widgets
	this.makeChildWidgets();
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
importWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(changedAttributes.conflictRules || changedAttributes.importRules) {
		this.refreshSelf();
		return true;
	} else {
		return this.refreshChildren(changedTiddlers);
	}
};


importWidget.prototype.ignoreIdenticalTiddlers = function (tiddler,existing){
    console.log(tiddler.fields.title," vs ",existing.fields.title);
    var checkedFields=[],status,IMPORTED="Imported",NOTIMPORTED="Not Imported";
    if( identicalFields(tiddler,existing) && identicalFields(existing,tiddler) ){
        console.log(" They are Identical!");
		status=false; //not import because are identical
	}else status=true;

	return {status:status , category : [tiddler.fields.title,status ? IMPORTED : NOTIMPORTED, "Older"] }

    function identicalFields(a,b){
        var af=a.fields, bf=b.fields,identical=true;
        for(var field in af)
           { if(checkedFields.indexOf(field) == -1){
                checkedFields.push(field);
                identical = b.hasField(field) && JSON.stringify(bf[field]) == JSON.stringify(af[field]);
                console.log("--identicals ",field,"?",bf[field],af[field],identical);
                if(!identical) return false;
                }
            }
            return true;
    }

};


importWidget.prototype.importtiddler = function (tiddler) {
    var importTiddler = {status:true}, title=tiddler.fields.title,self=this;
	this.newTiddlers=[];
	var existingTiddler = this.wiki.getTiddler(title);
	function reportTiddler()
	{console.log(" ",arguments[0][0], arguments[0].slice(1).join(" ")); self.report.add.apply(this,arguments[0]);}

    for(var i=0; importTiddler.status && i < this.importRules.length; i++) importTiddler = this.importRules[i](tiddler);
    if(! importTiddler.status){ reportTiddler(importTiddler.category);return false}


	if(existingTiddler){
	     for(var i=0; importTiddler.status && i < this.conflictRules.length; i++) importTiddler = this.conflictRules[i](tiddler,existingTiddler);
	     if(! importTiddler.status){ reportTiddler(importTiddler.category);return false}
    }
	else if(importTiddler.status)//is new and passed all previous filters?
		this.report.add(title,"Imported","New");

	// Fall through to adding the tiddler
	//$tw.wiki.addTiddler(tiddler);
	console.log("Imported ",tiddler.fields.title);
	return importTiddler.status;
};


// Import JSON tiddlers
importWidget.prototype.handleImportTiddlersEvent = function(event) {
	var self = this;
	// Get the tiddlers
	var tiddlers = [];
	try {
		tiddlers = JSON.parse(event.param);
	} catch(e) {
	}
	// Process each tiddler
	$tw.utils.each(tiddlers,function(tiddlerFields) {
		var title = tiddlerFields.title;
		// Add it to the store
		var imported = self.importtiddler(new $tw.Tiddler(
			self.wiki.getCreationFields(),
			self.wiki.getModificationFields(),
			tiddlerFields
		));
		if(imported) {
			self.report.add(title,"Imported","Overrided");
		}
	});


	this.generateReport();

	return false;
};

importWidget.prototype.generateReport= function(){
	var title = this.wiki.generateNewTitle("$:/temp/ImportReport"),self=this;


	   var tiddlerFields = {
			title: title,
			text: ""
		};

		tiddlerFields.text=this.report.compose();


		this.wiki.addTiddler(new $tw.Tiddler(
			self.wiki.getCreationFields(),
			tiddlerFields,
			self.wiki.getModificationFields()
		));


	this.dispatchEvent({
		type: "tw-navigate",
		navigateTo: title,
		navigateFromTitle: this.getVariable("storyTiddler"),
		navigateFromNode: this,
		navigateSuppressNavigation: event.metaKey || event.ctrlKey || (event.button === 1)
	});


};


importWidget.prototype.reporter = function(){
var store={},text="",mainList=[];

function joinList(list){
   return "# [[" + list.join("]]\n# [[") + "]]\n";
}


function compose(){ text=""; iterateStore(store,"!"); return text;}

function iterateStore(element,header){
if( element.hasOwnProperty("list") )
      text+=joinList(element.list);
else
     for(var el in element){
        text+= header + el + "\n";
		    iterateStore(element[el],header+"!")
		}
}

function add(element/*,topics and subtopics*/){
   var args = Array.prototype.slice.call(arguments, 1);
   if(mainList.indexOf(element) == -1 ){
       mainList.push(element);
       append(store,args);
   }

   function append(topic,subtopics){
        if(subtopics.length > 0){
            append(topic[subtopics[0]]= topic[subtopics[0]] || {} ,subtopics.slice(1))
        }else
            if(topic.hasOwnProperty("list")) topic.list.push(element); else topic.list=[element];
   }
}

return {add:add,compose:compose, getStore:function(){return store} };

};

exports.importwidget = importWidget;

})();