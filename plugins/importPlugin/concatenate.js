/*\
title: $:/macros/danielo/concatenate.js
type: application/javascript
module-type: macro
tags: macros
creator:Danielo Rodriguez

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

/*
Information about this macro
This returns the text field of the tiddlers defined by the filter concatenated with the separator as separator. 
*/

exports.name = "concatenate";

exports.params = [
	{ name: "filter" , "default":"[!is[system]sort[title]]"},
	{ name: "separator" , "default" : ","}
];

/*
Run the macro
*/
exports.run = function(filter,separator) {
    	
	var tiddlers=$tw.wiki.filterTiddlers(filter);
    var result=[];
    if(tiddlers.length < 1) return "";
	
	tiddlers.forEach(function(title)
    {
            result.push( $tw.wiki.getTiddlerText(title) );
    });

return result.join(separator);
}

})();