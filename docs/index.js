class SearchBox {
    constructor(el, data, keys, textFunction, resultSelectedCallback, numSearchResultsShown) {
        if (numSearchResultsShown === undefined) {
            numSearchResultsShown = 5;
        }

        this.numSearchResultsShown = numSearchResultsShown;
        this.textFunction = textFunction;
        this.resultSelectedCallback = resultSelectedCallback;

        this.searchContainer = document.createElement("div");
        this.searchContainer.className = "searchbox-container"
        el.append(this.searchContainer)

        this.textbox = document.createElement("input");
        this.textbox.type = "text";
        this.textbox.className = "searchbox-textbox";
        this.textbox.addEventListener("input", (e) => this.onTextboxChange(e));
        this.textbox.addEventListener("keydown", (e) => this.onTextboxKeydown(e));
        this.textbox.addEventListener("focus", (e) => this.onTextboxChange(e));
        this.searchContainer.append(this.textbox);

        this.searchResultsContainer = document.createElement("div");
        this.searchResultsContainer.className = "searchbox-searchresultscontainer"
        this.searchContainer.append(this.searchResultsContainer);

        this.fuse = new Fuse(data, { keys: keys });

        this.searchResults = [];
        this.searchResultElements = [];
        this.selectedResultIndex = 0;
    }

    onTextboxChange(e) {
        this.searchResults = this.fuse.search(this.textbox.value).slice(0, this.numSearchResultsShown);

        this.searchResultElements.forEach((e) => e.remove());

        this.searchResultElements = this.searchResults.map((searchResult, index) => {
            let searchResultElement = document.createElement("span");
            searchResultElement.innerText = this.textFunction(searchResult.item);
            searchResultElement.className = "searchbox-searchresult";
            searchResultElement.addEventListener("mouseover", e => this.onSearchResultHover(e, index))
            searchResultElement.addEventListener("click", e => this.onSearchResultClick(e))

            this.searchResultsContainer.append(searchResultElement);
            return searchResultElement;
        });

        this.selectedResultIndex = 0;
        this.updatedHighligtedResult();
    }

    onTextboxKeydown(e) {
        let dir = 0;
        switch (e.code) {
            case "ArrowUp":
                dir = -1;
                break;

            case "ArrowDown":
                dir = 1;
                break;

            case "Tab":
                dir = e.getModifierState("Shift") ? -1 : 1;
                break;

            case "Enter":
                this.onSearchResultClick();
                return;
                break;

            default:
                return;
        }

        e.preventDefault();

        if (this.searchResultElements.length == 0)
            return;

        this.selectedResultIndex += dir;

        if (this.selectedResultIndex < 0) {
            this.selectedResultIndex = this.searchResultElements.length - 1;
        }

        if (this.selectedResultIndex >= this.searchResultElements.length) {
            this.selectedResultIndex = 0;
        }

        this.updatedHighligtedResult();
    }

    updatedHighligtedResult() {
        this.searchResultElements.forEach((el, index) => {
            if (index == this.selectedResultIndex) {
                el.classList.add("searchbox-selectedresult");
            } else {
                el.classList.remove("searchbox-selectedresult");
            }
        });
    }

    onTextboxFocusout(e) {
        this.searchResultElements.forEach((e) => e.remove());
        this.selectedResultIndex = -1;
    }

    onSearchResultHover(e, index) {
        this.selectedResultIndex = index;
        this.updatedHighligtedResult();
    }

    onSearchResultClick(e) {
        this.resultSelectedCallback(this.searchResults[this.selectedResultIndex].item);
        this.onTextboxFocusout();
        this.textbox.value = "";
    }
}

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
                box: document.getElementById("settings-overlay"),
                choices: document.getElementById("settings-overlay-area-choices"),
                hideSearchbox: document.getElementById("settings-overlay-hide-searchbox"),
                hiddenNodesContainer: document.getElementById("settings-overlay-hidden-nodes-container"),
                hiddenNodes: document.getElementById("settings-overlay-hidden-nodes"),
                resetHiddenNodes: document.getElementById("settings-overlay-reset-hidden-nodes")
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

        this.areaFunction = this.AREA_FUNCTIONS['constant'];

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
            .filter(d => d.id === "constant")
            .property("checked", true)

        areaFunctionRadios
            .append("br")
    }

    onAreaFunctionChange(e, d) {
        this.areaFunction = this.AREA_FUNCTIONS[d.id];
        this.update();
    }

    onClassMouseover(e, d, ths) {
        if (d.data.type === "namespace") {
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
        let tree = d3.hierarchy(this.selectedData, (d) => { return d.children; });

        this.areaFunction(tree)

        tree.sort((a, b) => d3.descending(a.value, b.value));

        d3.pack()
            .size([this.width - 2 * this.margin, this.height - 2 * this.margin])
            .padding(5)
            (tree);

        let nodes = this.draggableGroup.selectAll("g")
            .data(tree.descendants(), d => d.data.id);

        let text = this.draggableGroup.selectAll("text")
            .data(tree.descendants(), d => d.data.id);

        let nodesEnter = nodes.enter()
            .append("g");

        let textEnter = text.enter()
            .append("text");

        nodesEnter.append("circle")
            .on("mouseover.info", (e, d) => this.onClassMouseover(e, d))
            .on("mouseover.stroke", function (e, d) {
                if (d.data.type === "namespace" || d.r === 0)
                    return;

                d3.select(this)
                    .transition()
                    .duration(100)
                    .attr("stroke", "black")
                    .attr("stroke-width", `${d.r * .1}px`)
            })
            .on("mouseout", function (e, d) {
                if (d.data.type === "namespace" || d.r === 0)
                    return;

                d3.select(this)
                    .interrupt()
                    .attr("stroke", "none")
            })
            .append("title")

        nodesEnter.append("path");

        nodes.merge(nodesEnter)
            .select("circle")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", d => d.r > 0 ? d.r : 1) // A little hacky - does a better solution to display classes with zero methods / size exist?
            .attr("fill", d => {
                if (d.children)
                    // this is a namespace, fill with the background color
                    return "#fff";

                if (d.r === 0)
                    // This is a "empty" class in some way - it should have stroke, but no fill
                    return "#ccc"

                return this.colors[d.data.type];
            })
            .attr("stroke", d => {
                if (d.children)
                    return "#ddd";

                if (d.r === 0)
                    return "#000";

                return null;
            })
            .attr("stroke-width", d => d.r === 0 ? .1 : d.r * .01)

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

        text.merge(textEnter)
            .filter(d => d.children)
            .attr("font-size", d => `${calculateNamespaceLabelFontSize(d)}px`)
            .append("textPath")
            .attr("xlink:href", d => `#text-curve-${d.data.id}`)
            .attr("text-anchor", "middle")
            .attr("startOffset", "50%")
            .text(d => d.data.name == "root" ? "" : d.data.name.split("::").at(-1))

        nodes.exit().remove();
    }

    async run() {
        await this.fetchData();

        let flattenedNodes = [];

        function flattenNodes(root) {
            let flattenedRoot = Object.assign({}, root);
            delete flattenedRoot["children"];
            flattenedNodes.push(flattenedRoot);

            root["children"].forEach(flattenNodes);
        }

        flattenNodes(this.classData);

        // Give the user a way to hide namespaces / classes they don't want to see
        new SearchBox(this.overlays.settings.hideSearchbox, flattenedNodes, ["name"],
            (item) => `${item.name} (${item.type == "namespace" ? "Namespace" : "Class"})`,
            (item) => {
                let hiddenNodes = JSON.parse(window.localStorage.getItem("hiddenNodes")) || [];

                // Have we hidden this node already?
                let shouldReturn = false;
                hiddenNodes.forEach((hiddenNode) => {
                    if (hiddenNode.name == item.name && ((item.type == "namespace" && hiddenNode.type == "namespace") || (item.type != "namespace" && hiddenNode.type != "namespace"))) {
                        shouldReturn = true;
                    }
                });

                if (shouldReturn)
                    return;

                let serializableItem = Object.assign({}, item);
                delete serializableItem.children;
                delete serializableItem.id; // Not guranteed to persist across updates to the data file

                hiddenNodes.push(serializableItem);
                window.localStorage.setItem("hiddenNodes", JSON.stringify(hiddenNodes));

                this.updateHiddenNodes();
            }
        );

        this.overlays.settings.resetHiddenNodes.addEventListener("click", () => {
            window.localStorage.setItem("hiddenNodes", "[]");
            this.updateHiddenNodes();
        });

        this.selectedData = this.classData;

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

        this.updateHiddenNodes(); // calls this.update()
    }

    updateHiddenNodes() {
        let hiddenNodes = JSON.parse(window.localStorage.getItem("hiddenNodes")) || [];

        // Set this.selectedData to be a subset of this.classData to hide all the nodes
        // we've been instructed to do
        this.selectedData = {}

        function reconstructTree(root) {
            let shouldReturn = false;
            hiddenNodes.forEach((hiddenNode) => {
                if (hiddenNode.name == root.name && ((root.type == "namespace" && hiddenNode.type == "namespace") || (root.type != "namespace" && hiddenNode.type != "namespace"))) {
                    shouldReturn = true;
                }
            });

            if (shouldReturn)
                return null;

            let reconstructedRoot = Object.assign({}, root);
            let children = root.children.map(reconstructTree);
            reconstructedRoot["children"] = children.filter((child) => child != null);

            return reconstructedRoot;
        }

        this.selectedData = reconstructTree(this.classData);
        this.updateHiddenNodesList();
        this.update();
    }

    updateHiddenNodesList() {
        let hiddenNodes = JSON.parse(window.localStorage.getItem("hiddenNodes")) || [];

        this.overlays.settings.hiddenNodesContainer.style.display = hiddenNodes.length == 0 ? "none" : "block";
        this.overlays.settings.hiddenNodes.replaceChildren(); // remove all existing nodes

        hiddenNodes.forEach((hiddenNode) => {
            let hiddenNodeElement = document.createElement("li");
            hiddenNodeElement.innerText = `${hiddenNode.name} (${hiddenNode.type == "namespace" ? "Namespace" : "Class"})`;
            this.overlays.settings.hiddenNodes.append(hiddenNodeElement);
        });
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