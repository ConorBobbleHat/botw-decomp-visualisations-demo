class BotwVisualisation {
    constructor(options) {
        this.el = options.el;
        this.width = options.width;
        this.height = options.height;

        this.overlay = {
            overlay: document.getElementById("overlay"),
            className: document.getElementById("overlay-class-name"),
            classStatus: document.getElementById("overlay-class-status")
        };
    }

    async run() {
        await this.fetchData();

        this.svg = d3.select("body").append("svg")
            .attr("width", this.width)
            .attr("height", this.height);

        this.simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(function (d) { return d.id; }))
            .force("charge", d3.forceManyBody().strength(-100))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            .on("tick", () => this.ticked());

        let simulationGroup = this.svg.append("g");

        function handleZoom(e) {
            simulationGroup.attr('transform', e.transform);
            return false;
        }

        let zoom = d3.zoom()
            .on('zoom', handleZoom);

        d3.select('svg')
            .call(zoom);

        this.link = simulationGroup.append("g")
            .attr("class", "links")
            .selectAll("line");

        this.node = simulationGroup.append("g")
            .attr("class", "nodes")
            .selectAll("circle");

        this.updateNetworkGraph();
    }

    updateNetworkGraph() {
        let tree = d3.hierarchy(this.classData, (d) => { return d.children; });

        this.link = this.link.data(tree.links(), (d) => { return d.target.data.id; })
            .join("line");

        this.node = this.node.data(tree.descendants(), (d) => { return d.data.id; })
            .join("circle")
            .attr("r", (d) => {
                if (d.data.name == "root")
                    return 12;

                return d.data.type == "namespace" ? 7 : 5
            })
            .attr("fill", (d) => {
                if (d.data.name == "root")
                    return "black";

                switch (d.data.type) {
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
            .on("dblclick", (e, d) => this.dblclick(e, d))
            .on("mouseover", (e, d) => {
                this.overlay.overlay.style.display = "block";
                this.overlay.className.innerText = d.data.name;
                this.overlay.classStatus.innerText = d.data.type;
            })
            .on("mouseout", (e, d) => {
                this.overlay.overlay.style.display = "none";
            })
            .call(this.drag(this.simulation));

        this.node.append("text")
            .attr("dy", ".35em")
            .text(function (d) { return d.data.name; });

        this.simulation.nodes(tree.descendants())
            .on("tick", () => this.ticked());

        this.simulation.force("link").links(tree.links());
    }

    ticked() {
        this.link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        this.node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    }

    dblclick(e, d) {
        if ((Array.isArray(d.data.children) && d.data.children.length == 0) || (Array.isArray(d.data._children) && d.data._children.length == 0)) {
            return;
        }

        if (d.data.children != null) {
            d.data._children = d.data.children;
            d.data.children = null;
            d.data.collapsed = true;
        } else {
            d.data.children = d.data._children;
            d.data._children = null;
            d.data.collapsed = false;
        }

        this.updateNetworkGraph();
    }

    drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    async fetchData() {
        this.classData = await d3.json("graph.json");

        // Collapse everything
        function recursivelyCollapse(obj) {
            obj._children = obj.children;
            obj.children = null;

            obj._children.forEach(recursivelyCollapse);
        }

        recursivelyCollapse(this.classData);
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    const botwVisualisations = new BotwVisualisation({
        el: document.body,
        width: 800,
        height: 500,
    });

    await botwVisualisations.run();
});