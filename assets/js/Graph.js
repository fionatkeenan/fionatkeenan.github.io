// Obsidian-style force-directed graph view, built with D3.
(function () {
  "use strict";

  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function initGraph() {
    var container = document.getElementById("graph-view");
    if (!container) return;

    var dataUrl = container.getAttribute("data-url") || "/GraphData.json";

    fetch(dataUrl)
      .then(function (res) { return res.json(); })
      .then(function (data) { renderGraph(container, data); })
      .catch(function (err) { console.warn("Error loading graph data", err); });
  }

  function renderGraph(container, data) {
    var width = container.clientWidth;
    var height = container.clientHeight || 500;

    var style = getComputedStyle(document.documentElement);
    var colors = {
      note: style.getPropertyValue("--brand").trim() || "#3ac9b0",
      tag: style.getPropertyValue("--text").trim() || "#6f6e69",
      link: style.getPropertyValue("--border").trim() || "#e6e4d9",
      text: style.getPropertyValue("--title").trim() || "#343331"
    };

    var svg = d3.select(container).append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [0, 0, width, height]);

    var zoomLayer = svg.append("g");

    svg.call(d3.zoom()
      .scaleExtent([0.2, 4])
      .on("zoom", function (event) {
        zoomLayer.attr("transform", event.transform);
      }));

    var nodes = data.nodes.map(function (d) { return Object.assign({}, d); });
    var links = data.links.map(function (d) { return Object.assign({}, d); });

    // Node degree drives radius, like Obsidian's "more connections = bigger node".
    var degree = {};
    links.forEach(function (l) {
      degree[l.source] = (degree[l.source] || 0) + 1;
      degree[l.target] = (degree[l.target] || 0) + 1;
    });
    nodes.forEach(function (n) {
      n.degree = degree[n.id] || 0;
    });

    var radius = d3.scaleSqrt().domain([0, d3.max(nodes, function (n) { return n.degree; }) || 1])
      .range([5, 14]);

    var simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(function (d) { return d.id; }).distance(70).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-160))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(function (d) { return radius(d.degree) + 8; }));

    var link = zoomLayer.append("g")
      .attr("stroke", colors.link)
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1);

    var node = zoomLayer.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "graph-node")
      .call(drag(simulation));

    node.append("circle")
      .attr("r", function (d) { return radius(d.degree); })
      .attr("fill", function (d) { return d.type === "tag" ? colors.tag : colors.note; })
      .attr("fill-opacity", function (d) { return d.type === "tag" ? 0.55 : 0.9; })
      .style("cursor", "pointer");

    node.append("title")
      .text(function (d) { return d.type === "tag" ? "#" + d.label : d.id; });

    var label = node.append("text")
      .text(function (d) { return d.type === "tag" ? "#" + d.label : d.id; })
      .attr("x", function (d) { return radius(d.degree) + 4; })
      .attr("y", 4)
      .attr("fill", colors.text)
      .attr("font-size", "11px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    node.on("click", function (event, d) {
      if (d.type === "note" && d.url) {
        window.location.href = d.url;
      }
    });

    node.on("mouseenter", function (event, d) {
      highlight(d);
    }).on("mouseleave", function () {
      clearHighlight();
    });

    function connectedIds(d) {
      var ids = new Set([d.id]);
      links.forEach(function (l) {
        var s = l.source.id || l.source;
        var t = l.target.id || l.target;
        if (s === d.id) ids.add(t);
        if (t === d.id) ids.add(s);
      });
      return ids;
    }

    function highlight(d) {
      var ids = connectedIds(d);
      node.style("opacity", function (n) { return ids.has(n.id) ? 1 : 0.15; });
      node.select("text").style("opacity", function (n) { return ids.has(n.id) ? 1 : 0; });
      link.style("opacity", function (l) {
        var s = l.source.id || l.source;
        var t = l.target.id || l.target;
        return (s === d.id || t === d.id) ? 1 : 0.05;
      });
    }

    function clearHighlight() {
      node.style("opacity", 1);
      node.select("text").style("opacity", 0);
      link.style("opacity", 0.6);
    }

    simulation.on("tick", function () {
      link
        .attr("x1", function (d) { return d.source.x; })
        .attr("y1", function (d) { return d.source.y; })
        .attr("x2", function (d) { return d.target.x; })
        .attr("y2", function (d) { return d.target.y; });

      node.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
    });

    function drag(simulation) {
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
      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    window.addEventListener("resize", function () {
      var w = container.clientWidth;
      var h = container.clientHeight || 500;
      svg.attr("viewBox", [0, 0, w, h]);
      simulation.force("center", d3.forceCenter(w / 2, h / 2));
      simulation.alpha(0.3).restart();
    });
  }

  onReady(initGraph);
})();
