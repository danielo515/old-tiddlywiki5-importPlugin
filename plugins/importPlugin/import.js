/*\
title: $:/core/modules/widgets/import-widget.js
type: application/javascript
module-type: widget


\*/

(function () {

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";

    var widget = require("$:/core/modules/widgets/widget.js").widget;

    var importWidget = function (parseTreeNode, options) {
        this.initialise(parseTreeNode, options);
        this.addEventListeners([
            {type: "tw-import-tiddlers", handler: "handleImportTiddlersEvent"},
            {type: "tw-confirm-import", handler: "handleConfirmImport"}

        ]);
    };


    /*
    Inherit from the base widget class
    */
    importWidget.prototype = new widget();

    /*
    Render this widget into the DOM
    */
    importWidget.prototype.render = function (parent, nextSibling) {
        this.parentDomNode = parent;
        this.computeAttributes();
        this.execute();
        this.renderChildren(parent, nextSibling);
    };


/*
    Compute the internal state of the widget
    */
    importWidget.prototype.execute = function () {
        var self = this;
        this.report = this.reporter();
        this.wiki.deleteTiddler("$:/temp/ImportReport");
        // Get our parameters
        this.navigate = this.getAttribute("navigate", "no").toLowerCase();
        var conflictRules = this.getAttribute("conflictRules");
        conflictRules = conflictRules && conflictRules.length > 0 ? conflictRules.toLowerCase().split(",") : [];
        console.log(conflictRules);
        var importrules = this.getAttribute("importRules");
        importrules = importrules && importrules.length > 0 ? importrules.split(";") : [];

        var rules = this._rules();

        this.conflictRules = [ rules.getRule("plugins"), rules.getRule("ignoreIdenticalTiddlers") ]; //ignore Identical the very first rule
        this.importRules=[];
        //construct the import rules array
        importrules.forEach(
            function (rule) { rule = rule.split(":");
                             self.importRules.push(
                                 rules.getRule(rule[0].toLowerCase())(rule[1].split(","))
                                 ); }
                            );
        //construct the conflict rules array
        for (var i=0; i<conflictRules.length; i++) this.conflictRules.push( rules.getRule(conflictRules[i]) );

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


/*Rules module*/
importWidget.prototype._rules=function(){
var IMPORTED="Imported",NOTIMPORTED="Not Imported";

function ignoreIdenticalTiddlers (tiddler,existing){
    console.log(tiddler.fields.title," vs ",existing.fields.title);
    var checkedFields=[],status;
    if( identicalFields(tiddler,existing) && identicalFields(existing,tiddler) ){
		status=false; //not import because are identical
	}else status=true;

	return {status:status , category : [tiddler.fields.title,status ? IMPORTED : NOTIMPORTED, "Identical"] }

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

}

function getResult(status,title /*category*/)
{
    var category=[ title, status ? IMPORTED : NOTIMPORTED ];
    var categories=Array.prototype.slice.call(arguments, 2);
    for(var i=0; i<categories.length;i++) category.push(categories[i]);

    return { status:status,category:category }
}

var rulesStore={
     "ignoreIdenticalTiddlers" : ignoreIdenticalTiddlers,
	 "plugins": function(tiddler,existing){
	 var status=true;
	 if(tiddler.hasField("plugin-type") && tiddler.hasField("version") && existing.hasField("plugin-type") && existing.hasField("version"))
		// Reject the incoming plugin if it is older
		status= $tw.utils.checkVersions(existing.fields.version,tiddler.fields.version) ? false : true;

		return getResult(status, tiddler.fields.title , "Pugins")
	  },
     "newestwins" :
	 function(tiddler,existing){ var status=tiddler.fields.modified > existing.fields.modified;
	 return getResult(status, tiddler.fields.title , status? "Newer than existing" :"Newer already exist") },
     "oldestwins" :
     function(tiddler,existing){ var status=tiddler.fields.modified < existing.fields.modified;
     return  getResult(status, tiddler.fields.title , "Older")},
     "longertextwins" :
     function(tiddler,existing){ var status=tiddler.fields.text.length > existing.fields.text.length;
     return getResult(status, tiddler.fields.title , "Shorter tan current")},
	 "includetags" :
	 function(tagsArr){
         return function(tiddler){
                        var status=true;
                        for(var i=0; status && i<tagsArr.length;i++){
					        status = tiddler.hasTag(tagsArr[i]);
							console.log("Tag ",tagsArr[i],status);
							}
							return getResult(status, tiddler.fields.title , "Filtered");
						}},
	"excludetags" : function(tagsArr){ return ! this.includetags(tagsArr) },
    };


return {
         getRule : function(ruleName){ return rulesStore[ruleName]}
       };
};


importWidget.prototype.importtiddler = function (tiddler) {
    var importTiddler = {status:true}, title=tiddler.fields.title,self=this,
    existingTiddler = this.wiki.getTiddler(title);
	
    function reportTiddler()
	{console.log(" ",arguments[0][0], arguments[0].slice(1).join(" ")); self.report.add.apply(this,arguments[0]);}

    for(var i=0; importTiddler.status && i < this.importRules.length; i++) importTiddler = this.importRules[i](tiddler);

	if(existingTiddler){
	     for(var i=0; importTiddler.status && i < this.conflictRules.length; i++) importTiddler = this.conflictRules[i](tiddler,existingTiddler);
    }
	
    if(! importTiddler.status){ 
        reportTiddler(importTiddler.category);return false}
    else{ if(existingTiddler) //filters passed but not new
            this.report.add(title,"Imported","Overriden");
          else//filters passed and new
            this.report.add(title,"Imported","New");
        }
    
	return importTiddler.status;
};


importWidget.prototype.handleConfirmImport = function(event){
    console.log("Import confirmed! ",this.importList);

};
// Import JSON tiddlers
importWidget.prototype.handleImportTiddlersEvent = function(event) {
	var self = this;
	this.importList=[];
	// Get the tiddlers
	var tiddlers = [];
	try {
		tiddlers = JSON.parse(event.param);
	} catch(e) {
	}
	// Process each tiddler
	$tw.utils.each(tiddlers,function(tiddlerFields) {
		var title = tiddlerFields.title;
        var tiddler=new $tw.Tiddler(self.wiki.getCreationFields(),self.wiki.getModificationFields(),tiddlerFields);
		var imported = self.importtiddler(tiddler);
		if(imported) {
			self.importList.push(tiddler);
		}
	});


	this.generateReport();

	return false;
};

importWidget.prototype.generateReport= function(){
	var title ="$:/temp/ImportReport",self=this;//this.wiki.generateNewTitle("$:/temp/ImportReport")

       var tiddlerFields = {
			title: title,
			text: '\n<$button message="tw-confirm-import">Confirm</$button>\n\n'
		};

		tiddlerFields.text+=this.report.compose();


		this.wiki.addTiddler(new $tw.Tiddler(
			self.wiki.getCreationFields(),
			tiddlerFields,
			self.wiki.getModificationFields()
		));

 if(this.navigate !== "no")
	this.dispatchEvent({
		type: "tw-navigate",
		navigateTo: title,
		navigateFromTitle: this.getVariable("storyTiddler"),
		navigateFromNode: this,
		navigateSuppressNavigation: event.metaKey || event.ctrlKey || (event.button === 1)
	});


};

/*Module that takes care of the report*/
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
		iterateStore(element[el],header+"!");
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
            append(topic[subtopics[0]]= topic[subtopics[0]] || {} ,subtopics.slice(1));
        }else
            if(topic.hasOwnProperty("list")) topic.list.push(element); else topic.list=[element];
   }
}

return {add:add,compose:compose, getStore:function(){return store} };

};

exports.importwidget = importWidget;

})();