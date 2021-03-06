/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual.databarKPIB8060E2B144244C5A38807466893C9F5  {
    "use strict";

    import tooltip = powerbi.extensibility.utils.tooltip;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import TooltipEventArgs = powerbi.extensibility.utils.tooltip.TooltipEventArgs;
    import ValueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;

    export class BarDataTransform {
        public data: BarData;
        public statusMessage: string;
    }

    export class Field {
        public value: number;
        public format: string;
        public displayName: string;
        public displayUnits: number;

        public constructor(value: number, format:string, displayName: string, displayUnits? : number) {
            this.value = value;
            this.format = format;
            this.displayName = displayName;
            this.displayUnits = displayUnits ? displayUnits : 0;
        }

        public toString(withFormatting?: boolean) {
            if (withFormatting) {
                return ValueFormatter.create({ format: this.format, value: this.displayUnits })
                                     .format(this.value)           
            } 
            else {
                return this.value.toString();
            }
        }
    }

    export class BarData {
        public value: Field;
        public target: Field;
        public max: Field;

        public tooltipsData : Field[];

        public constructor() {
            this.tooltipsData = [];
        }

        public gapBetweenValueAndTarget(): Field {
            var ff = new Field(this.target.value - this.value.value, 
                               this.value.format,
                               "Gap - " + this.value.displayName + " & " + this.target.displayName)

            return ff;
        }

        public gapBetweenValueAndMax(): Field {
            var ff = new Field(this.max.value - this.value.value, 
                               this.value.format,
                               "Gap - " + this.value.displayName + " & " + this.max.displayName)

            return ff;
        }
    }

    /**
     * Function that converts queried data into a view model that will be used by the visual
     *
     * @function
     * @param {VisualUpdateOptions} options - Contains references to the size of the container
     *                                        and the dataView which contains all the data
     *                                        the visual had queried.
     * @param {IVisualHost} host            - Contains references to the host which contains services
     */
    function visualTransform(options: VisualUpdateOptions, host: IVisualHost): BarDataTransform {
        /*Convert dataView to your viewModel*/
        var bdf = new BarDataTransform();
        
        var values = options.dataViews[0].table.rows[0];

        //now set up my data
        //loop through the data set and set up a value mapping table
        var valueArray = []
        valueArray["tooltips"] = [];
        for (var i = 0; i < options.dataViews[0].table.columns.length; i++) {
            var columnRole = options.dataViews[0].table.columns[i].roles;
            if (columnRole["value"] == true) {
                valueArray["value"] = i;
            }
            if (columnRole["target"] == true) {
                valueArray["target"] = i;
            }
            if (columnRole["max"] == true) {
                valueArray["max"] = i;
            }
            if (columnRole["tooltips"] == true) {
                valueArray["tooltips"].push(i)
            }
        }       

        if (valueArray["value"] == undefined || valueArray["target"] == undefined) {
            bdf.data = null;
            bdf.statusMessage = "value and target not both supplied. It is a mandatory to provide at least these two values.";
            return bdf;
        } 
        
        //collect the data
        var data = new BarData();

        var columnsRef = options.dataViews[0].table.columns;

        data.value = new Field(Number(values[valueArray["value"]].toString()),
                            columnsRef[valueArray["value"]].format,
                            columnsRef[valueArray["value"]].displayName);
        
        data.target = new Field(Number(values[valueArray["target"]].toString()),
                                columnsRef[valueArray["target"]].format,
                                columnsRef[valueArray["target"]].displayName);
        
        if (valueArray["max"] != undefined) {
            data.max = new Field(Number(values[valueArray["max"]].toString()),
                                columnsRef[valueArray["max"]].format,
                                columnsRef[valueArray["max"]].displayName);
        } 
        else {
            //if it's not defined like other visuals we render it as the target times 2
            data.max = new Field(data.target.value * 2, 
                                    data.target.format, 
                                    "(" + data.target.displayName + " * 2)");
        }

        if (data.target.value > data.max.value) {
            bdf.data = null;
            bdf.statusMessage = "Target (" + data.target.value + ") is greater than max (" + data.max.value + "). This is not allowed";
            return bdf;
        }

        // now process the tooltips
        for (var i = 0; i < valueArray["tooltips"].length; i++) {
            var toolTipIndex = valueArray["tooltips"][i];
            var tooltipF = new Field(
                Number(values[toolTipIndex].toString()),
                columnsRef[toolTipIndex].format,
                columnsRef[toolTipIndex].displayName,
                this.settings.textSettings.displayUnits
            );
            data.tooltipsData.push(tooltipF);
        }

        bdf.data = data;
        bdf.statusMessage = null;

        return bdf;
    }

    export class databarvisual implements IVisual {
        private target: HTMLElement;
        private settings: VisualSettings;

        //svg elements
        private host: IVisualHost;
        private percentageBarElement;
        private ActualTxtElement;
        private GoalTxtElement;
        private mainBarElement;
        private dashedLineElement;
        private bottomPaddingElement;
        private svg: d3.Selection<any>;

        private selectionManager : ISelectionManager;

        private tooltipServiceWrapper: tooltip.ITooltipServiceWrapper;

        constructor(options: VisualConstructorOptions) {
            console.log('Visual constructor', options);
            this.target = options.element;
            this.host = options.host;
            this.selectionManager = options.host.createSelectionManager();

            this.tooltipServiceWrapper = tooltip.createTooltipServiceWrapper(
                                                options.host.tooltipService,
                                                options.element);
            
            this.canvas_setup();

        }

        public update(options: VisualUpdateOptions) {
            this.settings =  databarvisual.parseSettings(options && options.dataViews && options.dataViews[0]);
            console.log('Visual update', options);
            
            this.canvas_clear();
            debugger;
            var transform = visualTransform(options,this.host);

            if (transform.data == null) {
                //print out the error message
            }        
            else {  
                var data = transform.data;    
                
                //add the display units from settings
                var tS = this.settings.textSettings;
                data.value.displayUnits = tS.displayUnitsForValue ? tS.displayUnitsForValue : tS.displayUnits;
                data.max.displayUnits = tS.displayUnitsForMax != 0 ? tS.displayUnitsForMax : tS.displayUnits;
                data.target.displayUnits = tS.displayUnits;

                //we need to derive the status bar color
                var statusBarColor = this.settings.colorSettings.equalToColor;
                if (data.value.value > data.target.value) {
                    statusBarColor = this.settings.colorSettings.greaterThanColor
                } 
                else if (data.value.value < data.target.value) {
                    statusBarColor = this.settings.colorSettings.lessThanColor;
                }

                if (this.settings.textSettings.showValueText) {
                    this.ActualTxtElement.style("fill",statusBarColor)
                }

                //Let's derive some of the sizing
                var svgWidth = parseInt(this.svg.style("width"))
                var svgHeight = parseInt(this.svg.style("height"))

                if (this.settings.textSettings.showValueText == true) {
                    var yActText = svgHeight
                    
                    //get the formatted value string
                    this.ActualTxtElement.append("text")
                                        .attr("y", yActText)
                                        .classed("valueTxt",true)
                                        .text(data.value.toString(true))
                                        .style("font-size",this.settings.textSettings.fontSize + "px")
                                        .style("font-family","'Segoe UI', 'wf_segoe-ui_normal', helvetica, arial, sans-serif;")
                                        .style("fill",statusBarColor)
                }            

                if (this.settings.textSettings.showMaxText == true) {
                    var yGoalValueTxt = svgHeight
                    //get the formatted target string
                    var tmp = this.GoalTxtElement.append("text")
                                    .text(data.max.toString(true))
                                    .classed("goalTxt",true)
                                    .attr("y", yGoalValueTxt)
                                    .style("font-size",this.settings.textSettings.fontSize + "px")
                                    .style("font-family","'Segoe UI', 'wf_segoe-ui_normal', helvetica, arial, sans-serif;")
                    
                    tmp.attr("x", svgWidth - this.GoalTxtElement.node().getBBox().width)
                }

                //below is the actual visual code
                var percentageDone = (data.value.value / data.target.value) * 100
                var percentageMTDTarget = (data.target.value / data.max.value) * 100

                //now do the bar placement 

                //derive the bar attributes using the overall text height
                var remainingRoom = svgHeight;
                if (this.settings.textSettings.showMaxText == true) {
                    remainingRoom = yGoalValueTxt - this.GoalTxtElement.node().getBBox().height
                } 
                if (this.settings.textSettings.showValueText == true) {
                    remainingRoom = yActText - this.ActualTxtElement.node().getBBox().height
                }

                //make the margin be 5% of the room
                var marginAroundBar = (remainingRoom * 0.15)
                var heightOfBar = remainingRoom - (marginAroundBar * 2)
                
                //remove any prerenders
                this.mainBarElement     .append("rect")
                                        .classed("mabar",true)
                                        .attr("width","100%")
                                        .attr("fill",this.settings.outerBarSettings.fill)
                                        .attr("stroke",this.settings.outerBarSettings.outlineColor)
                                        .attr("height",heightOfBar)
                                        .attr("y",marginAroundBar)
                                        .attr("x", 0)
                
                //remove any prerenders
                this.percentageBarElement.selectAll(".percentageBar")
                                        .data([data])
                                        .enter()
                                        .append("rect")
                                        .classed("pebar",true)
                                        .attr("x",0)
                                        .attr("width",0)
                                        .attr("height",heightOfBar)
                                        .attr("fill",statusBarColor)
                                        .attr("y", marginAroundBar)
                                        .attr("width",percentageDone + "%")
                
                this.dashedLineElement.append("line")
                                    .classed("tline",true)
                                    .attr("y1",0)
                                    .attr("x1",percentageMTDTarget + "%")
                                    .attr("x2",percentageMTDTarget + "%")
                                    .attr("y2", svgHeight - this.GoalTxtElement.node().getBBox().height)
                                    .style("stroke",this.settings.targetLineSettings.color)
                                    .style("stroke-width",this.settings.targetLineSettings.strokeWidth)                  
                
                if (this.settings.targetLineSettings.lineStyle == "dashed") {
                    this.dashedLineElement.select(".tline").style("stroke-dasharray","2,2");
                }

                let selectionManager = this.selectionManager; 
                
                this.tooltipServiceWrapper.addTooltip(
                    this.percentageBarElement,
                    (tooltipEvent: TooltipEventArgs<number>) => databarvisual.getToolTipDataForBar(tooltipEvent.data,this.settings),
                    (tooltipEvent: TooltipEventArgs<number>) => null);        
            }
        }

        public static getToolTipDataForBar(dataNonCasted: any, settings :VisualSettings) : VisualTooltipDataItem[] {
            
            var data:BarData = dataNonCasted;

            var gapTargetField = data.gapBetweenValueAndTarget();
            gapTargetField.displayUnits = settings.textSettings.displayUnits;
            var gapMaxField = data.gapBetweenValueAndMax();
            gapMaxField.displayUnits = settings.textSettings.displayUnits;

            var tooltipDataFieldList = [data.value, data.target, data.max].map(function(f) {
                return { displayName: f.displayName, value: f.toString(true) }
            })

            //get the formatted max string
            if (settings.textSettings.repPositiveGapAsNegativeNumber == true) {
                gapTargetField.value = gapTargetField.value * -1;
                gapMaxField.value = gapMaxField.value * -1;
            }

            var formattedGapValueTarget = "";
            var formattedGapValueMax = "";

            if (settings.textSettings.showPercentagesOnGaps == true) {
                var formatter = ValueFormatter.create({ format: "0.00 %;-0.00 %;0.00 %", value: 1, allowFormatBeautification: true });
                if (data.target) {
                    var formattedPercent = formatter.format(Math.abs(gapTargetField.value) / data.target.value)
                    formattedGapValueTarget = gapTargetField.toString(true) + "(" + formattedPercent + ")";
                }
                if (data.max) {
                    var formattedPercent = formatter.format(Math.abs(gapMaxField.value) / data.max.value)
                    formattedGapValueMax = gapMaxField.toString(true) + "(" + formattedPercent + ")";
                }
            }

            tooltipDataFieldList.push(
                {
                    displayName: gapTargetField.displayName,
                    value: formattedGapValueTarget
                }
            );

            tooltipDataFieldList.push(
                {
                    displayName: gapMaxField.displayName,
                    value: formattedGapValueMax
                }
            );

            //now let's push the tooltips
            for (var i = 0; i < data.tooltipsData.length; i++) {
                var ttData = data.tooltipsData[i];
                tooltipDataFieldList.push(
                    {
                        displayName: ttData.displayName,
                        value: ttData.toString(true)
                    }
                )
            }

            //now return the tooltip data
            return tooltipDataFieldList;

        }

        private canvas_setup() {

            var container = d3.select(this.target)

            this.svg = container.append("svg")
                                .attr("width", "100%")
                                .attr("height", "100%")

            //draw the text
            this.ActualTxtElement = this.svg.append("g")
                                            .classed("valueText",true)

            this.GoalTxtElement = this.svg.append("g")
                                          .classed("maxText",true)
                                          
            this.mainBarElement = this.svg.append("g")
                                          .classed("outerBar", true)

            this.percentageBarElement = this.svg.append("g")
                                                .classed("percentageBar",true)
            
            //append the dashed line for the current goal
            this.dashedLineElement = this.svg.append("g")
                                             .classed("targetLine", true)
        }

        private canvas_clear() {
            //clear the visual canvas
            this.dashedLineElement.selectAll(".tline").remove()
            this.ActualTxtElement.selectAll(".valueTxt").remove()
            this.GoalTxtElement.selectAll(".goalTxt").remove()
            this.percentageBarElement.selectAll(".pebar").remove()
            this.mainBarElement.selectAll(".mabar").remove()
        }

        private static parseSettings(dataView: DataView): VisualSettings {
            return VisualSettings.parse(dataView) as VisualSettings;
        }

        /** 
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the 
         * objects and properties you want to expose to the users in the property pane.
         * 
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        }
    }
}