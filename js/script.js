const margin = { top: 40, right: 40, bottom: 40, left: 60 };
const width = 600 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const naRegions = ['ME', 'NH', 'VT', 'MA', 'CT', 'RI', 'NY', 'NJ', 'PA', 'MD', 'DE', 'WV', 'VA', 'NC', 'SC', 'GA', 'FL', 'AL', 'MS', 'TN', 'KY', 'OH', 'IN', 'IL', 'MI', 'WI', 'IA', 'MN', 'ND', 'SD', 'NE', 'KS', 'OK', 'MO', 'AR', 'LA', 'TX', 'NM', 'CO', 'WY', 'MT', 'ID', 'UT', 'AZ', 'NV', 'CA', 'OR', 'WA', 'AK', 'NL', 'NS', 'PE', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC', 'YT', 'NT', 'NU'] // All 49 US States, 10 Canadian provinces, and 3 Canadian territories located in continental North America; used to filter data to avoid showing overseas regions far away from other data
const colorScale = d3.scaleLinear(d3.schemeSet2).domain([-20, 90])
  .range(['royalblue', 'red']);
const optionsColor = ['avg_temp', 'max_temp', 'min_temp'];
const optionsSize = ['precip', 'snow'];
const optionsUnits = ['metric', 'US'];

const t = 1000;

const varDict = {
    "lat": "Latitude",
    "lon": "Longitude",
    "avg_temp": "Average Daily Temperature",
    "max_temp": "Average Maximum Temperature",
    "min_temp": "Average Minimum Temperature",
    "precip": "Monthly Precipitation",
    "snow": "Monthly Snow",
    "metric": "Metric",
    "US": "US Customary"
};

let allData = [];
let xVar = 'lon', yVar = 'lat', sizeVar = 'precip', colorVar = 'avg_temp', unitVar = 'metric', targetMonth = 1;
let xScale, yScale, sizeScale;
let countryFeatures, stateFeatures;

const svg = d3.select('#vis')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

const legendSvg = d3.select('#legend')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', 125);

// A special function to take the element-wise average of an array of datapoints. If all states and months are not the same, an error is thrown.
function average(weather_objects) {
    lat_sum = 0;
    lon_sum = 0;
    avg_temp_sum = 0;
    max_temp_sum = 0;
    min_temp_sum = 0;
    precip_sum = 0;
    snow_sum = 0;
    month = null;
    state = null;

    weather_objects.forEach((element) => {
        lat_sum += element.lat;
        lon_sum += element.lon;
        avg_temp_sum += element.avg_temp;
        max_temp_sum += element.max_temp;
        min_temp_sum += element.min_temp;
        precip_sum += element.precip;
        snow_sum += element.snow;
        if(state == null) {
            state = element.state;
        } else if(state != element.state) {
            throw new Error('state mismatch');
        }
        if(month == null) {
            month = element.month;
        } else if(month != element.month) {
            throw new Error('month mismatch');
        }
    });

    return {
        month: month,
        lat: lat_sum / weather_objects.length,
        lon: lon_sum / weather_objects.length,
        state: state,
        avg_temp: avg_temp_sum / weather_objects.length,
        max_temp: max_temp_sum / weather_objects.length,
        min_temp: min_temp_sum / weather_objects.length,
        precip: precip_sum / weather_objects.length * 30,
        snow: snow_sum / weather_objects.length * 30
    }
}

function init() {
    Promise.all([
        d3.csv('./data/weather.csv', function (d) {
        return {
            month: months[+d.date.substring(4, 6) - 1],
            lat: +d.latitude,
            lon: +d.longitude,
            state: d.state,
            avg_temp: +d.TAVG,
            max_temp: +d.TMAX,
            min_temp: +d.TMIN,
            precip: +d.PRCP,
            snow: +d.SNOW
        }
        }),
        d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'),
        d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
    ]).then(([data, countries, states]) => {
        countryFeatures = topojson.feature(countries, countries.objects.countries).features
            .filter(d => d.id === '124' || d.id === '840');
        stateFeatures = topojson.feature(states, states.objects.states).features;
        allData = [];
        allDataByMonth = [[], [], [], [], [], [], [], [], [], [], [], []]; // A 2-D array, where the index i contains datapoints from the (i + 1)th month of the year
        avgByState = [[], [], [], [], [], [], [], [], [], [], [], []]; // A 2-D array, where the index i contains datapoints from the (i + 1)th month of the year, and the index j within each month's array contains data corresponding to the region at index j in naRegions (e.g. the first entry of the first array contains average January conditions for Maine; the last entry of the third array contains average March conditions for Nunavut)

        // Filter out non-continental North America regions. If avg_temp is null, compute this value based on the arithmetic average of min_temp and max_temp. If either min_temp or max_temp are null, exclude the datapoint. Null values are converted to 0, but manual inspection of weather.csv reveals that no avg_temp, max_temp, or min_temp value is 0, so such values can be treated as null.
        data.forEach((element) => {
            if (naRegions.includes(element.state)) {
                if (element.min_temp != 0 && element.max_temp != 0) {
                    if (element.avg_temp == 0) {
                        element.avg_temp = (element.max_temp + element.min_temp) / 2;
                    }
                    allData.push(element);
                }
            }
        });

        allData.forEach((element) => {
            allDataByMonth[months.indexOf(element.month)].push(element);
        });

        naRegions.forEach((region) => {
            monthNum = 0;
            allDataByMonth.forEach((monthData) => {
                dataToAverage = [];
                monthData.forEach((element) => {
                    if(element.state == region) {
                        dataToAverage.push(element);
                    }
                });
                if(dataToAverage.length == 0) {
                    avgByState[monthNum].push({
                        avg_temp: null,
                        lat: null,
                        lon: null,
                        max_temp: null,
                        min_temp: null,
                        month: months[monthNum],
                        precip: null,
                        snow: null,
                        state: region
                    })
                } else {
                    avgByState[monthNum].push(average(dataToAverage));
                }
                monthNum += 1;
            });
        });

        allData = [];
        avgByState.forEach((row) => {
            row.forEach((col) => {
                allData.push(col);
            });
        });

        setupSelector();
        updateAxes();
        updateVis();
    })
        .catch(error => console.error('Error loading data:', error));
}

window.addEventListener('load', init);

function setupSelector() {
    d3.select('#value').text(months[targetMonth - 1]);

    let slider = d3
        .sliderHorizontal()
        .min(1)
        .max(9)
        .step(1)
        .width(width * 0.9)
        .displayValue(false)
        .on('onchange', (val) => {
            d3.select('#value').text(months[val - 1]);
            targetMonth = +val;
            updateVis();
        })
        .default(targetMonth);

    d3.select('#slider')
        .append('svg')
        .attr('width', width)
        .attr('height', 100)
        .append('g')
        .attr('transform', 'translate(30,30)')
        .call(slider);

    d3.select('#colorVariable')
        .each(function () {
            d3.select(this).selectAll('myOptions')
                .data(optionsColor)
                .enter()
                .append('option')
                .text(d => varDict[d]) // The displayed text
                .attr("value", d => d) // The actual value used in the code
        });
    
    d3.select('#sizeVariable')
        .each(function () {
            d3.select(this).selectAll('myOptions')
                .data(optionsSize)
                .enter()
                .append('option')
                .text(d => varDict[d]) // The displayed text
                .attr("value", d => d) // The actual value used in the code
        });
    
    d3.select('#unitVariable')
        .each(function () {
            d3.select(this).selectAll('myOptions')
                .data(optionsUnits)
                .enter()
                .append('option')
                .text(d => varDict[d]) // The displayed text
                .attr("value", d => d) // The actual value used in the code
        });

    d3.select('#colorVariable').property('value', colorVar);
    d3.select('#sizeVariable').property('value', sizeVar);
    d3.select('#unitVariable').property('value', unitVar);

    d3.selectAll('.variable')
        .each(function () {
        })
        .on("change", function (event) {
            if (d3.select(this).property("id") == "colorVariable") {
                colorVar = d3.select(this).property("value");
            }

            if (d3.select(this).property("id") == "sizeVariable") {
                sizeVar = d3.select(this).property("value");
            }

            if (d3.select(this).property("id") == "unitVariable") {
                unitVar = d3.select(this).property("value");
            }
            updateAxes();
            updateVis();
        })
}

function updateAxes() {
    svg.selectAll('.axis').remove()
    svg.selectAll('.labels').remove()

    xScale = d3.scaleLinear()
        .domain([d3.min(allData, d => d[xVar]), d3.max(allData, d => d[xVar])])
        .range([0, width]);
    yScale = d3.scaleLinear()
        .domain([d3.min(allData, d => d[yVar]), d3.max(allData, d => d[yVar])])
        .range([height, 0]);

    sizeScale = d3.scaleSqrt()
        .domain([0, d3.max(allData, d => d[sizeVar])]) // Largest bubble = largest data point 
        .range([3, 10]); // Feel free to tweak these values if you want bigger or smaller bubbles

    drawMap();
    drawLegends();
}

function geographicPath() {
    const transform = d3.geoTransform({
        point(longitude, latitude) {
            this.stream.point(xScale(longitude), yScale(latitude));
        }
    });
    return d3.geoPath(transform);
}

function drawMap() {
    svg.selectAll('.map-layer').remove();
    const path = geographicPath();
    const map = svg.append('g').attr('class', 'map-layer');

    map.selectAll('.country')
        .data(countryFeatures)
        .join('path')
        .attr('class', 'country')
        .attr('d', path)
        .attr('fill', '#f7f7f7')
        .attr('stroke', '#8a8a8a')
        .attr('stroke-width', 1);

    map.selectAll('.state')
        .data(stateFeatures)
        .join('path')
        .attr('class', 'state')
        .attr('d', path)
        .attr('fill', '#eeeeee')
        .attr('fill-opacity', 0.5)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 0.5);

    map.lower();
}

function drawLegends() {
    legendSvg.selectAll('.legend').remove();

    const colorLegend = legendSvg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${margin.left}, 20)`);
    const colorGradient = colorLegend.append('defs')
        .append('linearGradient')
        .attr('id', 'temperature-gradient');
    colorGradient.append('stop').attr('offset', '0%').attr('stop-color', colorScale(-20));
    colorGradient.append('stop').attr('offset', '100%').attr('stop-color', colorScale(90));
    colorLegend.append('rect')
        .attr('width', 140).attr('height', 12)
        .attr('fill', 'url(#temperature-gradient)');
    colorLegend.append('text').attr('y', -4).text(varDict[colorVar]);
    colorLegend.append('text').attr('y', 28).text('-20°F');
    colorLegend.append('text').attr('x', 140).attr('y', 28)
        .attr('text-anchor', 'end').text('90°F');

    const sizeLegend = legendSvg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${margin.left}, 75)`);
    const maxSize = d3.max(allData, d => d[sizeVar]);
    const legendValues = [maxSize / 4, maxSize / 2, maxSize];
    sizeLegend.append('text').attr('y', -4).text(varDict[sizeVar]);
    sizeLegend.selectAll('circle')
        .data(legendValues)
        .join('circle')
        .attr('cx', (d, i) => 18 + i * 48)
        .attr('cy', d => 25 - sizeScale(d))
        .attr('r', d => sizeScale(d))
        .attr('fill', 'none')
        .attr('stroke', '#555');
    sizeLegend.selectAll('text.value')
        .data(legendValues)
        .join('text')
        .attr('class', 'value')
        .attr('x', (d, i) => 18 + i * 48)
        .attr('y', 42)
        .attr('text-anchor', 'middle')
        .text(d => d.toFixed(1));
}

function updateVis() {
    let currentData = allData.filter(d => d.month === months[targetMonth - 1]);
    svg.selectAll('.points')
        .data(currentData, d => d.state)
        .join(
            function (enter) {
                return enter
                    .append('circle')
                    .attr('class', 'points')
                    .attr('cx', d => xScale(d[xVar])) // Position on x-axis
                    .attr('cy', d => yScale(d[yVar])) // Position on y-axis
                    .style('fill', d => colorScale(d[colorVar]))
                    .style('opacity', .5)  // Default color for now
                    .attr('r', 0) // Bubble size
                    .on('mouseover', function (event, d) {
                        //console.log(d) // See the data point in the console for debugging
                        d3.select('#tooltip')
                            // if you change opacity to hide it, you should also change opacity here
                            .style("display", 'block') // Make the tooltip visible
                            .html( // Change the html content of the <div> directly
                                `<strong>${d.state}</strong><br/>
                ${varDict[colorVar]}: ${unitVar == 'metric' ? ((d[colorVar] - 32) * 5 / 9).toFixed(1) + ' °C': (d[colorVar]).toFixed(1) + ' °F'}<br>
                ${varDict[sizeVar]}: ${unitVar == 'metric' ? (d[sizeVar] * 2.54).toFixed(2) + ' cm' : (d[sizeVar]).toFixed(2) + ' in'}`)
                            .style("left", (event.pageX + 20) + "px")
                            .style("top", (event.pageY - 28) + "px");
                        d3.select(this) // Refers to the hovered circle
                            .style('stroke', 'black')
                            .style('stroke-width', '2px')
                    })
                    .on("mouseout", function (event, d) {
                        d3.select('#tooltip')
                            .style('display', 'none')
                        d3.select(this)
                            .style('stroke', 'none') // Hide tooltip when cursor leave
                    })
                    .transition(t)
                    .attr('r', d => sizeScale(d[sizeVar])) // Bubble size

            },
            function (update) {
                return update
                    .transition(t)
                    .attr('cx', d => xScale(d[xVar]))
                    .attr('cy', d => yScale(d[yVar]))
                    .style('fill', d => colorScale(d[colorVar]))
                    .attr('r', d => sizeScale(d[sizeVar]))
            },
            function (exit) {
                exit.transition(t)
                    .attr('r', 0)
                    .remove()
            }
        )
}

/*
This visualization shows a map, where each circle represents a state, province, or territory and depicts a temperature variable (color) and a precipitation variable (size).
To avoid the map showing regions that are outliers in their locations (far away from other data points), I included only locations that are part of mainland North America: the 49 continental US states, 9 Canadian provinces, and 1 Canadian territory. Regions like Hawaii and US territories were excluded. Of the continental US and Canada, the dataset is missing Washington, DC, Saskatchewan, the Yukon, and Nunavut.
Filters and queries are included from Category I and tooltips are included from Category II. The units selection dropdown could maybe count as an additional Category II feature. Other features could be added if there is time.
I chose the blue-red color scale for the temperature variables for a reason that is probably obvious and used precipitation amounts and snow amounts for size. I have not included other variables due to much missing data.
I used a fixed range for the color scale (-20 to 90 degrees Fahrenheit) as opposed to a dynamic range to highlight the contrast between mean, maximum, and minimum temperatures in addition to the spatial differences.
The dataset does not contain October through December data, hence why these months are not in the slider.
For the purpose of answering the last write-up question, I probably spent about six hours working so far, and processing the data (constructing the allDataByMonth and the avgByState arrays from the raw data) and debugging various issues with these arrays.
Please feel free to clean up and format this code as needed.
*/