// Variables to store Geoserver information
let geoserverUrl = '';
let currentWorkspace = '';
let activeLayers = [];
let allLayers = [];
let map;

// Initialize map after the page has loaded
document.addEventListener('DOMContentLoaded', function () {
  // Initialize map
  map = new ol.Map({
    target: 'map',
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM()
      })
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([0, 0]),
      zoom: 2
    })
  });
});

// Toggle function to expand/collapse the controls panel
function toggleControls() {
  const controlsElement = document.getElementById('controls');
  controlsElement.classList.toggle('expanded');

  // Update map size to ensure proper rendering after panel state change
  setTimeout(() => {
    map.updateSize();
  }, 300); // Wait for transition to complete
}

// Function to load capabilities from GeoServer using WMS GetCapabilities
async function loadCapabilities() {
  try {
    // Get the GeoServer URL from the input field
    const serverUrl = document.getElementById('geoserverUrl').value;

    // Ensure URL doesn't end with a slash
    geoserverUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;

    // Use WMS GetCapabilities instead of REST API
    const response = await fetch(`${geoserverUrl}/wms?service=WMS&version=1.3.0&request=GetCapabilities`);

    if (!response.ok) {
      throw new Error(`Failed to connect to GeoServer: ${response.statusText}`);
    }

    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");

    console.log("GetCapabilities response parsed successfully");

    // Extract layers from GetCapabilities response
    const layerElements = xmlDoc.getElementsByTagName('Layer');
    allLayers = [];
    const workspaces = new Set();

    // Start from index 1 to skip the root Layer element
    for (let i = 1; i < layerElements.length; i++) {
      const nameEl = layerElements[i].getElementsByTagName('Name')[0];
      const titleEl = layerElements[i].getElementsByTagName('Title')[0];

      if (nameEl && nameEl.textContent) {
        const name = nameEl.textContent;
        const title = titleEl ? titleEl.textContent : name;

        if (name.includes(':')) {
          const workspace = name.split(':')[0];
          const layerName = name.split(':')[1];
          workspaces.add(workspace);

          allLayers.push({
            fullName: name,
            workspace: workspace,
            name: layerName,
            title: title
          });
        }
      }
    }

    console.log(`Found ${workspaces.size} workspaces and ${allLayers.length} layers`);

    // Populate workspace dropdown
    const workspaceSelect = document.getElementById('workspace');
    workspaceSelect.innerHTML = '';

    // Add "Select a Workspace" option
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'Select a Workspace';
    workspaceSelect.appendChild(allOption);

    // Add each workspace as an option
    Array.from(workspaces).sort().forEach(workspace => {
      const option = document.createElement('option');
      option.value = workspace;
      option.textContent = workspace;
      workspaceSelect.appendChild(option);
    });

    document.getElementById('workspaceSelector').style.display = 'block';

    // Show all layers initially
    filterLayers();

    // Expand the controls to show results
    document.getElementById('controls').classList.add('expanded');

  } catch (error) {
    console.error('Error loading capabilities:', error);
    alert(`Failed to connect to GeoServer: ${error.message}`);
  }
}

// Function to filter layers by selected workspace
function filterLayers() {
  currentWorkspace = document.getElementById('workspace').value;
  const layerListEl = document.getElementById('layerList');

  // Clear the layer list
  layerListEl.innerHTML = '';

  // Only show layers if a specific workspace is selected
  if (currentWorkspace) {
    layerListEl.innerHTML = '<h3>Available Layers in ' + currentWorkspace + ':</h3>';

    // Filter layers by the selected workspace
    const filteredLayers = allLayers.filter(layer => layer.workspace === currentWorkspace);

    if (filteredLayers.length > 0) {
      filteredLayers.forEach(layer => {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'layer-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `layer-${layer.fullName}`;
        checkbox.value = layer.fullName;
        checkbox.onchange = function () { toggleLayer(this); };

        const label = document.createElement('label');
        label.htmlFor = `layer-${layer.fullName}`;
        label.textContent = layer.title || layer.name;

        layerDiv.appendChild(checkbox);
        layerDiv.appendChild(label);
        layerListEl.appendChild(layerDiv);
      });
    } else {
      layerListEl.innerHTML += '<p>No layers found in this workspace</p>';
    }
  } else {
    // If "All Workspaces" is selected (empty value), show instructions
    layerListEl.innerHTML = '<h3>Workspaces Available</h3>';
    layerListEl.innerHTML += '<p>Please select a specific workspace to view its layers</p>';

    // Show list of available workspaces as a reference
    const workspaces = new Set(allLayers.map(layer => layer.workspace));
    if (workspaces.size > 0) {
      const workspaceList = document.createElement('ul');
      Array.from(workspaces).sort().forEach(workspace => {
        const wsItem = document.createElement('li');
        wsItem.textContent = workspace;
        workspaceList.appendChild(wsItem);
      });
      layerListEl.appendChild(workspaceList);
    }
  }
}

// Function to toggle a layer on/off
function toggleLayer(checkbox) {
  const layerName = checkbox.value;

  if (checkbox.checked) {
    // Add layer to map
    const newLayer = new ol.layer.Tile({
      source: new ol.source.TileWMS({
        url: `${geoserverUrl}/wms`,
        params: {
          'LAYERS': layerName,
          'TILED': true
        },
        serverType: 'geoserver'
      }),
      title: layerName
    });

    map.addLayer(newLayer);
    activeLayers.push({ name: layerName, layer: newLayer });
    console.log(`Added layer: ${layerName}`);
  } else {
    // Remove layer from map
    const layerIndex = activeLayers.findIndex(l => l.name === layerName);
    if (layerIndex >= 0) {
      map.removeLayer(activeLayers[layerIndex].layer);
      activeLayers.splice(layerIndex, 1);
      console.log(`Removed layer: ${layerName}`);
    }
  }
}