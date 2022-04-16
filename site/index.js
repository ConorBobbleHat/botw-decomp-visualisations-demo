const DATA_URL = "https://raw.githubusercontent.com/zeldaret/botw/master/data/uking_functions.csv";

const EXECUTABLE_MIN_ADDRESS = 0x7100000000;
const EXECUTABLE_MAX_ADDRESS = 0x71026ac43f;
const EXECUTABLE_SIZE = EXECUTABLE_MAX_ADDRESS - EXECUTABLE_MIN_ADDRESS + 1;

class Utils {
    static demangleFunctionName(mangledName) {
        // A partial implementation of the Itanium C++ Name Mangling Spec (https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling)
        // Good enough to pull a method's name out of a mangled string (i.e. for the purposes of visualisation)
        if (!mangledName.startsWith("_Z"))
            return mangledName; // Not actually mangled

        // The format of a mangled function name consists of 
        // - the magic "_Z"
        // - various letters indicating qualifiers attached to the function
        // - the fully qualified name of the function. Each piece of the FQN has its length prefixed to it. For example,
        //   hello::World::again would become "5hello5world5again"
        // - an encoding of the types of the arguments the function takes
        // So, to find the function's name, all we have to do is look for the first number in the mangled name,
        // read the piece of it's FQN, and repeat until we can't find another FQN piece to parse.
        const firstFQNPieceIndex = mangledName.search(/[0-9]/);

        let functionFQN = [];
        let workingName = mangledName.slice(firstFQNPieceIndex);

        while (true) {
            let pieceLength = workingName.match(/^\d+/);

            if (pieceLength == null)
                break;

            let pieceLengthChars = pieceLength[0].length; // The number of characters it takes to represent our length value
            pieceLength = Number(pieceLength);

            let fqnPiece = workingName.slice(pieceLengthChars, pieceLength + pieceLengthChars);
            functionFQN.push(fqnPiece);

            workingName = workingName.slice(pieceLength + pieceLengthChars);
        };

        return functionFQN.join("::");
    }
}

class BotwVisualisations {
    constructor(options) {
        this.el = options.el;
        this.width = options.width;
        this.height = options.height;
    }

    async run() {
        await this.fetchData();

        this.svg = d3.select("body").append("svg")
            .attr("width", this.width)
            .attr("height", this.height);

        let simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(function (d) { return d.id; }))
            .force("charge", d3.forceManyBody())
            .force("center", d3.forceCenter(this.width / 2, this.height / 2));

        let simulationGroup = this.svg.append("g");

        function handleZoom(e) {
            simulationGroup.attr('transform', e.transform);
            return false;
        }

        let zoom = d3.zoom()
            .on('zoom', handleZoom);

        d3.select('svg')
            .call(zoom);

        let link = simulationGroup.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(this.classData.edges)
            .enter().append("line")
            .attr("stroke-width", function (d) { return "10px"; });

        let node = simulationGroup.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(this.classData.nodes)
            .enter().append("circle")
            .attr("r", function (d) { return d.type == "namespace" ? 7 : 5})
            .attr("fill", function (d) { 
                switch (d.type) {
                    case "namespace":
                        return "blue";
                        break;
                    
                    case "undecompiled_class":
                        return "red";
                        break;
                    
                    case "partially_decompiled_class":
                        return "orange";
                        break;

                    case "decompiled_class":
                        return "green";
                        break;
                }
             })
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        node.append("title")
            .text(function (d) { return d.name; });

        simulation
            .nodes(this.classData.nodes)
            .on("tick", ticked);

        simulation.force("link")
            .links(this.classData.edges);

        function ticked() {
            link
                .attr("x1", function (d) { return d.source.x; })
                .attr("y1", function (d) { return d.source.y; })
                .attr("x2", function (d) { return d.target.x; })
                .attr("y2", function (d) { return d.target.y; });

            node
                .attr("cx", function (d) { return d.x; })
                .attr("cy", function (d) { return d.y; });

        }
    }

    async fetchData() {
        this.functionsData = await d3.csv(DATA_URL, (d) => {
            return {
                address: parseInt(d["Address"], 16),
                name: Utils.demangleFunctionName(d["Name"]),
                quality: d["Quality"],
                size: parseInt(d["Size"]),
            }
        });

        this.classData = await d3.json("/graph.json");
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    const botwVisualisations = new BotwVisualisations({
        el: document.body,
        width: 800,
        height: 500,
    });

    await botwVisualisations.run();
});