const margin = { top: 80, right: 60, bottom: 60, left: 100 };
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

// The margin code above

// Global variables
let allData = []
let xVar = 'income', yVar = 'lifeExp', sizeVar = 'population', targetYear = 2000
let xScale, yScale, sizeScale

const continents = ['Africa', 'Asia', 'Oceania', 'Americas', 'Europe']
const colorScale = d3.scaleOrdinal(continents, d3.schemeSet2); // d3.schemeSet2 is a set of predefined colors. 
const options = ['income', 'lifeExp', 'gdp', 'population', 'childDeaths']
const optionLabels = {
    income: 'Income per Person',
    lifeExp: 'Life Expectancy',
    gdp: 'GDP per Capita',
    population: 'Population',
    childDeaths: 'Child Deaths'
}

// Create SVG
const svg = d3.select('#vis')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

svg.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${height})`)

svg.append('g')
    .attr('class', 'y-axis')

// functions
d3.csv('./data/gapminder_subset.csv', {})
  .then(data => {
        console.log(data)
        allData = data
        // placeholder for building vis
        // placeholder for adding listerners
    })

function init(){
    d3.csv("./data/gapminder_subset.csv", 
    // this is the callback function, applied to each item in the array
    function(d){
        return {  
        // Besides converting the types, we also simpilify the variable names here. 
        country: d.country,
        continent: d.continent,
        year: +d.year, // using + to convert to numbers; same below
        lifeExp: +d.life_expectancy, 
        income: +d.income_per_person, 
        gdp: +d.gdp_per_capita, 
        childDeaths: +d.number_of_child_deaths,
        // Your turn: 
        population: +d.population
     }
    })
    .then(data => {
            console.log(data) // Check the structure in the console
            allData = data // Save the processed data

            // Initial rendering steps:
            // P.S. You could move these into setupSelector(), 
            setupSelector()
            // but calling them separately makes the flow clearer.
            updateAxes()
            updateVis()
            addLegend()
        })
    .catch(error => console.error('Error loading data:', error));
}

function setupSelector(){
    let slider = d3
        .sliderHorizontal()
        .min(d3.min(allData.map(d => +d.year))) // setup the range
        .max(d3.max(allData.map(d => +d.year))) // setup the range
        .step(1)
        .width(width)  // Widen the slider if needed
        .displayValue(false)
        .on('onchange', (val) => {
            targetYear = +val // Update the year
            updateVis() // Refresh the chart
        });

    d3.select('#slider')
        .append('svg')
        .attr('width', width)  // Adjust width if needed
        .attr('height', 100)
        .append('g')
        .attr('transform', 'translate(30,30)')
        .call(slider);

    d3.selectAll('.variable')
   // loop over each dropdown button
    .each(function() {
        d3.select(this).selectAll('myOptions')
        .data(options)
        .enter()
        .append('option')
        .text(d => optionLabels[d]) // The displayed text
        .attr("value",d => d) // The actual value used in the code
    })
    .on("change", function (event) {
         // identify which dropdown was changed
        const id = d3.select(this).property("id");
        const value = d3.select(this).property("value");
        // Your turn: Map to global variables
        if (id === "xVariable") {
            xVar = value;
        } else if (id === "yVariable") {
            yVar = value;
        } else if (id === "sizeVariable") {
            sizeVar = value;
        }
        updateAxes(); 
        updateVis();
    })
    
    d3.select('#xVariable').property('value', xVar)
    d3.select('#yVariable').property('value', yVar)
    d3.select('#sizeVariable').property('value', sizeVar)
}

function updateAxes(){
    svg.selectAll('.axis').remove()
    svg.selectAll('.labels').remove()
    xScale = d3.scaleLinear()
        .domain([0, d3.max(allData, d => d[xVar])])
        .range([0, width]);

    yScale = d3.scaleLinear()
        .domain([0, d3.max(allData, d => d[yVar])])
        .range([height, 0]);

    svg.select(".x-axis")
        .call(d3.axisBottom(xScale));

    svg.select(".y-axis")
        .call(d3.axisLeft(yScale));
    
    sizeScale = d3.scaleSqrt()
    .domain([0, d3.max(allData, d => d[sizeVar])]) // Largest bubble = largest data point 
    .range([5, 20]); // Feel free to tweak these values if you want bigger or smaller bubbles

    // X-axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 20)
        .attr("text-anchor", "middle")
        .text(xVar) // Displays the current x-axis variable
        .attr('class', 'labels')

    // Y-axis label (rotated)
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 40)
        .attr("text-anchor", "middle")
        .text(yVar) // Displays the current y-axis variable
        .attr('class', 'labels')
}

function updateVis(){
  // Filter data for the current year
    let currentData = allData.filter(d => d.year === targetYear)
    const t = d3.transition().duration(750)

    svg.selectAll('.points')
    .data(currentData, d => d.country)
    .join(
        // When we have new data points
        function(enter){
            return enter
            .append('circle')
            .attr('class', 'points')
            .attr('cx', d => xScale(d[xVar])) // Position on x-axis
            .attr('cy', d => yScale(d[yVar])) // Position on y-axis
            .attr('r',  d => sizeScale(d[sizeVar])) // Bubble size
            .style('fill', d => colorScale(d.continent))
            .on('mouseover', function (event, d) {
            // console.log(d) // See the data point in the console for debugging
                d3.select('#tooltip')
                    // if you change opacity to hide it, you should also change opacity here
                    .style("display", 'block') // Make the tooltip visible
                    .html( // Change the html content of the <div> directly
                    `<strong>${d.country}</strong><br/>
                    Continent: ${d.continent}`)
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 28) + "px");
                
                 d3.select(this) // Refers to the hovered circle
                    .style('stroke', 'black')
                    .style('stroke-width', '4px')
            })
            .on("mouseout", function (event, d) {
                d3.select('#tooltip')
                .style('display', 'none') // Hide tooltip when cursor leaves

                d3.select(this)
                    .style('stroke', 'none')
                    .style('stroke-width', null)
            })
            .transition(t) // Apply transition to bubble size
            .attr('r', d => sizeScale(d[sizeVar])) 
        },
        // Update existing points when data changes
        function(update){
            return update
            .attr('cx', d => xScale(d[xVar]))
            .attr('cy', d => yScale(d[yVar]))
            .attr('r',  d => sizeScale(d[sizeVar]))
        },
        // Remove points that no longer exist in the filtered data 
        function(exit){
            exit.remove()
        }
    )
    .attr('r',  d => sizeScale(d[sizeVar]))
    // Apply continent colors
    .style('fill', d => colorScale(d.continent))
    .style('opacity', .5) // Slight transparency for better visibility
}

function addLegend(){
    let size = 10  // Size of the legend squares

  // Your turn, draw a set of rectangles using D3
    svg.selectAll('continentSquare')
        .data(continents)
        .enter()
        .append('rect')
        .attr('class', 'continentSquare')
        .attr('width', size)
        .attr('height', size)
        .attr('x', (d, i) => i * (size + 100) + 100)
        .attr('y', -margin.top / 2)
        .style("fill", d => colorScale(d))

     svg.selectAll("continentName")
        .data(continents)
        .enter()
        .append("text")
        .attr("y", -margin.top/2 + size) // Align vertically with the square
        .attr("x", (d, i) => i * (size + 100) + 120)  
        .style("fill", d => colorScale(d))  // Match text color to the square
        .text(d => d) // The actual continent name
        .attr("text-anchor", "left")
        .style('font-size', '13px')
}
window.addEventListener('load', init);