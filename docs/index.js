class BotwVisualisation {
    constructor(options) {
        this.el = options.el;
        this.width = options.width;
        this.height = options.height;
        this.margin = options.margin;

        this.colors = {
            "not_yet_decompiled_class": "#d62728",
            "partially_decompiled_class": "#ff7f0e",
            "decompiled_class": "#2ca02c"
        }

        this.overlays = {
            class: {
                box: document.getElementById("class-overlay"),
                name: document.getElementById("class-overlay-name"),
                info: document.getElementById("class-overlay-info")
            },
            settings: {
                choices: document.getElementById("settings-overlay-area-choices")
            }
        }

        this.AREA_FUNCTIONS = {
            "constant": (tree) => { tree.count() },
            "num_methods": (tree) => { tree.sum(d => d.num_methods) },
            "total_binary_size": (tree) => { tree.sum(d => d.total_binary_size) }
        }

        const AREA_FUNCTION_OPTIONS = [
            { name: "Constant", id: "constant" },
            { name: "Number of Methods", id: "num_methods" },
            { name: "Total Binary Size", id: "total_binary_size" }
        ];

        this.area_function = this.AREA_FUNCTIONS['constant'];

        let areaFunctionRadios = d3.select(this.overlays.settings.choices)
            .selectAll("label")
            .data(AREA_FUNCTION_OPTIONS)
            .join("label")
            .text(d => d.name)

        areaFunctionRadios.append("input")
            .lower()
            .attr("type", "radio")
            .attr("name", "areaOptions")
            .on("change", (e, d) => this.onAreaFunctionChange(e, d))
            .filter(d => d.id == "constant")
            .property("checked", true)

        areaFunctionRadios
            .append("br")
    }

    onAreaFunctionChange(e, d) {
        this.area_function = this.AREA_FUNCTIONS[d.id];
        this.update();
    }

    onClassMouseover(e, d) {
        if (d.data.type == "namespace")  {
            return false;
        }

        this.overlays.class.box.style.display = "block";
        this.overlays.class.name.innerText = d.data.name;

        let status = {
            "not_yet_decompiled_class": "Not Yet Decompiled",
            "partially_decompiled_class": "Partially Decompiled",
            "decompiled_class": "Decompiled"
        }[d.data.type];

        this.overlays.class.info.innerHTML = `
            <ul>
                <li>Status: ${status}</li>
                <li>Number of Methods: ${d.data.num_methods}</li>
                <li>Total Binary Size: ${d.data.total_binary_size.toLocaleString()} bytes</li>
            </ul>
        `
    }

    update() {
        let tree = d3.hierarchy(this.classData, (d) => { return d.children; });

        this.area_function(tree)

        tree.sort((a, b) => d3.descending(a.value, b.value));

        d3.pack()
            .size([this.width - 2 * this.margin, this.height - 2 * this.margin])
            .padding(5)
            (tree);

        let nodes = this.draggableGroup.selectAll("g")
            .data(tree.descendants(), d => d.data.id);

        let nodesEnter = nodes.enter()
            .append("g");

        nodesEnter.append("circle")
            .on("mouseover", (e, d) => this.onClassMouseover(e, d))
            //.on("mouseout", (e, d) => this.overlays.class.box.style.display = "none")
            .append("title")
            
        nodesEnter.append("path");
        nodesEnter.append("text");

        nodes.merge(nodesEnter)
            .select("circle")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", d => d.r > 0 ? d.r : 1) // A little hacky - does a better solution to display classes with zero methods / size exist?
            .attr("fill", d => {
                if (d.children)
                    // this is a namespace, fill with the background color
                    return "#fff";

                if (d.r == 0)
                    // This is a "empty" class in some way - it should have stroke, but no fill
                    return "#ccc"

                return this.colors[d.data.type];
            })
            .attr("stroke", d => {
                if (d.children)
                    return "#ddd";

                if (d.r == 0)
                    return "#000";
                
                return null;
            })
            .attr("stroke-width", d => d.r == 0 ? .1 : d.r * .01)

            .select("title")
            .text(d => d.data.name)


        function calculateNamespaceLabelFontSize(d) {
            return d.r * .2;
        }

        nodes.merge(nodesEnter)
            .select("path")
            .filter(d => d.children)
            .attr("d", d => {
                let effectiveRadius;

                if (!d.parent || d.parent.children.length < 10) {
                    effectiveRadius = d.r; // outside
                } else if (d.children.length > 10) {
                    effectiveRadius = d.r - calculateNamespaceLabelFontSize(d) * .25; // middle 
                } else {
                    effectiveRadius = d.r - calculateNamespaceLabelFontSize(d); // inside
                }

                return `M ${d.x} ${d.y + effectiveRadius} A ${-effectiveRadius} ${-effectiveRadius} 0 1 1 ${d.x + .01} ${d.y + effectiveRadius}`
            })
            .attr("fill", "none")
            .attr("id", d => `text-curve-${d.data.id}`)

        nodes.merge(nodesEnter)
            .select("text")
            .filter(d => d.children)
            .attr("font-size", d => `${calculateNamespaceLabelFontSize(d)}px`)
            .append("textPath")
            .attr("xlink:href", d => `#text-curve-${d.data.id}`)
            .attr("text-anchor", "middle")
            .attr("startOffset", "50%")
            .text(d => d.data.name.split("::").at(-1))

        nodes.exit().remove();
    }

    async run() {
        await this.fetchData();

        this.svg = d3.select("body").append("svg")
            .attr("id", "svg")
            .attr("viewBox", [-this.margin, -this.margin, this.width, this.height]);


        let draggableGroup = this.svg.append("g");
        this.draggableGroup = draggableGroup;

        function handleZoom(e) {
            draggableGroup.attr('transform', e.transform);
        }

        let zoom = d3.zoom()
            .on('zoom', handleZoom);

        d3.select('svg')
            .call(zoom);

        this.update();
    }

    async fetchData() {
        this.classData = await d3.json("graph.json");
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    const botwVisualisations = new BotwVisualisation({
        el: document.body,
        width: 2400,
        height: 1200,
        margin: 100,
    });

    await botwVisualisations.run();
});