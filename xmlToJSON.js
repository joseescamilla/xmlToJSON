/* Copyright 2015 William Summers, MetaTribal LLC
 * adapted from https://developer.mozilla.org/en-US/docs/JXON
 *
 * Licensed under the MIT License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * @author William Summers
 *
 */

(function () {
    'use strict';
    function factory() {

        var version = "2.0.0-dev";

        var globalOptions = { // set up the default options
            mergeCDATA: false, // extract cdata and merge with text
            grokAttr: false, // convert truthy attributes to boolean, etc
            grokText: false, // convert truthy text/attr to boolean, etc
            normalize: true, // collapse multiple spaces to single space
            xmlns: true, // include namespaces as attributes in output
            namespaceKey: '_ns', // tag name for namespace objects
            textKey: '_text', // tag name for text nodes
            valueKey: '_value', // tag name for attribute values
            attrKey: '_attr', // tag for attr groups
            cdataKey: '_cdata', // tag for cdata nodes (ignored if mergeCDATA is true)
            commentKey: '_comment', // tag for comment nodes
            instructionKey: '_instruction', // tag for processing instructions
            attrsAsObject: true, // if false, key is used as prefix to name, set prefix to '' to merge children and attrs.
            stripAttrPrefix: true, // remove namespace prefixes from attributes
            stripElemPrefix: true, // for elements of same name in diff namespaces, you can enable namespaces and access the nskey property
            childrenAsArray: true // force children into arrays
        };

        var prefixMatch = new RegExp(/(?!xmlns)^.*:/);
        var trimMatch = new RegExp(/^\s+|\s+$/g);

        var grokType = function (sValue) {
            if (/^\s*$/.test(sValue)) {
                return null;
            }
            if (/^(?:true|false)$/i.test(sValue)) {
                return sValue.toLowerCase() === "true";
            }
            if (isFinite(sValue)) {
                return parseFloat(sValue);
            }
            return sValue;
        };

        // TODO: Clean up options processing
        var parseString = function (xmlString, opt) {
            var localoptions = {}
            opt = opt || {}
            // initialize options
            for (var key in globalOptions) {
                localoptions[key] = (opt[key] === undefined) ? globalOptions[key] : opt[key];
            }
            return this.parseXML(this.stringToXML(xmlString), localoptions);
        }

        var parseXML = function (oXMLParent, options) {

            var vResult = {},
                nLength = 0,
                sCollectedTxt = "";

            // parse namespace information
            if (options.xmlns && oXMLParent.namespaceURI) {
                vResult[options.namespaceKey] = oXMLParent.namespaceURI;
            }

            // parse attributes
            // using attributes property instead of hasAttributes method to support older browsers
            if (oXMLParent.attributes && oXMLParent.attributes.length > 0) {
                var vAttribs = {};

                for (nLength; nLength < oXMLParent.attributes.length; nLength++) {
                    var oAttrib = oXMLParent.attributes.item(nLength);
                    vContent = {};
                    var attribName = '';

                    if (options.stripAttrPrefix) {
                        attribName = oAttrib.name.replace(prefixMatch, '');

                    } else {
                        attribName = oAttrib.name;
                    }

                    if (options.grokAttr) {
                        vContent[options.valueKey] = grokType(oAttrib.value.replace(trimMatch, ''));
                    } else {
                        vContent[options.valueKey] = oAttrib.value.replace(trimMatch, '');
                    }

                    if (options.xmlns && oAttrib.namespaceURI) {
                        vContent[options.namespaceKey] = oAttrib.namespaceURI;
                    }

                    if (options.attrsAsObject) { // attributes with same local name must enable prefixes
                        vAttribs[attribName] = vContent;
                    } else {
                        vResult[options.attrKey + attribName] = vContent;
                    }
                }

                if (options.attrsAsObject) {
                    vResult[options.attrKey] = vAttribs;
                } else { }
            }

            // iterate over the children
            if (oXMLParent.hasChildNodes()) {
                for (var oNode, sProp, vContent, nItem = 0; nItem < oXMLParent.childNodes.length; nItem++) {
                    oNode = oXMLParent.childNodes.item(nItem);

                    if (oNode.nodeType === 4) {
                        if (options.mergeCDATA) {
                            sCollectedTxt += oNode.nodeValue;
                        } else {
                            if (vResult.hasOwnProperty(options.cdataKey)) {
                                if (vResult[options.cdataKey].constructor !== Array) {
                                    vResult[options.cdataKey] = [vResult[options.cdataKey]];
                                }
                                vResult[options.cdataKey].push(oNode.nodeValue);

                            } else {
                                if (options.childrenAsArray) {
                                    vResult[options.cdataKey] = [];
                                    vResult[options.cdataKey].push(oNode.nodeValue);
                                } else {
                                    vResult[options.cdataKey] = oNode.nodeValue;
                                }
                            }
                        }
                    } /* nodeType is "CDATASection" (4) */
                    else if (oNode.nodeType === 3) {
                        sCollectedTxt += oNode.nodeValue;
                    } /* nodeType is "Text" (3) */
                    else if (oNode.nodeType === 1) { /* nodeType is "Element" (1) */

                        if (nLength === 0) {
                            vResult = {};
                        }

                        // using nodeName to support browser (IE) implementation with no 'localName' property
                        if (options.stripElemPrefix) {
                            sProp = oNode.nodeName.replace(prefixMatch, '');
                        } else {
                            sProp = oNode.nodeName;
                        }

                        vContent = xmlToJSON.parseXML(oNode, options);

                        if (vResult.hasOwnProperty(sProp)) {
                            if (vResult[sProp].constructor !== Array) {
                                vResult[sProp] = [vResult[sProp]];
                            }
                            vResult[sProp].push(vContent);

                        } else {
                            if (options.childrenAsArray) {
                                vResult[sProp] = [];
                                vResult[sProp].push(vContent);
                            } else {
                                vResult[sProp] = vContent;
                            }
                            nLength++;
                        }
                    }
                    // TODO:  The trouble with comment parsing is that the keys need
                    // to be unique and comments can occur multiple times within a node.
                    // Should a rolling id be added to each one?  doesn't sound great
                    // should we simply ignore comments?
                    // the same will also apply to processing instructions.
                    else if (oNode.nodeType === 8) {
                        // if (vResult.hasOwnProperty(options.commentKey)) {
                        //     if (vResult[options.commentKey].constructor !== Array) {
                        //         vResult[options.commentKey] = [vResult[options.commentKey]];
                        //     }
                        //     vResult[options.commentKey].push(oNode.nodeValue);

                        // }
                        // else {
                        //     if (options.childrenAsArray) {
                        //         vResult[options.commentKey] = [];
                        //         vResult[options.commentKey].push(oNode.nodeValue);
                        //     } else {
                        vResult[options.commentKey] = oNode.nodeValue;
                        //     }
                        // }
                    } /* nodeType is "Comment" (8) */
                    else {
                        console.debug('unknown type: ' + oNode.nodeType)
                    }
                }
            } else if (!sCollectedTxt) { // no children and no text, return null
                if (options.childrenAsArray) {
                    vResult[options.textKey] = [];
                    vResult[options.textKey].push(null);
                } else {
                    vResult[options.textKey] = null;
                }
            }

            if (sCollectedTxt) {
                if (options.grokText) {
                    var value = grokType(sCollectedTxt.replace(trimMatch, ''));
                    if (value !== null && value !== undefined) {
                        vResult[options.textKey] = value;
                    }
                } else if (options.normalize) {
                    vResult[options.textKey] = sCollectedTxt.replace(trimMatch, '').replace(/\s+/g, " ");
                } else {
                    vResult[options.textKey] = sCollectedTxt.replace(trimMatch, '');
                }
            }

            return vResult;
        }


        // Convert xmlDocument to a string
        // Returns null on failure
        var xmlToString = function (xmlDoc) {
            try {
                var xmlString = xmlDoc.xml ? xmlDoc.xml : (new XMLSerializer()).serializeToString(xmlDoc);
                return xmlString;
            } catch (err) {
                return null;
            }
        }

        // Convert a string to XML Node Structure
        // Returns null on failure
        var stringToXML = function (xmlString) {
            try {
                var xmlDoc = null;

                if (window.DOMParser) {

                    var parser = new DOMParser();
                    xmlDoc = parser.parseFromString(xmlString, "text/xml");

                    return xmlDoc;
                } else {
                    xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
                    xmlDoc.async = false;
                    xmlDoc.loadXML(xmlString);

                    return xmlDoc;
                }
            } catch (e) {
                return null;
            }
        }

        return {
            version: version,
            xmlToString: xmlToString,
            stringToXML: stringToXML,
            parseString: parseString,
            parseXML: parseXML
        }

    }

    // Set up the correct environment (Node, AMD, or browser)

    if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = factory; // NodeJS
    }
    else if (typeof define === 'function' && define.amd) {
        define([], factory); // AMD 
    }
    else if (typeof window === 'object') {
        window.xmlToJSON = factory(); // Otherwise, leak into the global space.
    } else {
        console.error('xmlToJSON was not loaded because a browser or module environment was not detected.')
    }

})();



