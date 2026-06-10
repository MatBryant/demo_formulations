
    /* simple pathfinding algorithm */
export function pathFind(graph: {[key: string]: any}): {distance: number, path: string[]}{
        const costs = Object.assign({end: Infinity}, graph.start);
        const parents: {[key: string]: string} = {end: ''};
        var processed: string[] = [];
        let node = findLowestCostNode(costs, processed);

        while (node) {
            let cost = costs[node];
            let children = graph[node];
            for (let n in children) {
                let newCost = cost + children[n];
                if (!costs[n] || costs[n] > newCost) {
                    costs[n] = newCost;
                    parents[n] = node;
                }
            }
            processed.push(node);
            node = findLowestCostNode(costs, processed);
        }

        let optimalPath = [`end`];
        let parent = parents.end;
        while (parent) {
            optimalPath.push(parent);
            parent = parents[parent];
        }
        optimalPath.reverse();
        return {distance: costs.end, path: optimalPath};
    };

    /* utility for Dijkstra's algorithm  */
function findLowestCostNode(costs: {[key: string]: number}, processed: string[]): string {
        return Object.keys(costs).reduce((lowest, node) => {
            if (lowest === '' || costs[node] < costs[lowest]) {
                if (!processed.includes(node)) {
                    lowest = node;
                }
            }
            return lowest;
        }, '');
    }; 