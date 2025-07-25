/* global Cesium */

console.log("✅ load3DModels.js script is running...");

// Tokens
const siteGeoJsonAssetId = 3121093;
const siteAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZjZjMDliMC04MDQ3LTRhMWQtYmI4ZC1hOTQ2NzJmYTUyYzUiLCJpZCI6MjQ3MDE2LCJpYXQiOjE3Mzk0Mjk0NjB9.d7CmmzSJzF4xYG24dvZ76GjJVQL-0DiTihjq4bzdYxY";

const ticketGeoJsonAssetId = 3330579;
const ticketAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4MGYxODE5YS1mYTA4LTRmMTQtODNjMC0xMDc0ODNmODRmYzMiLCJpZCI6Mjk0MTA5LCJpYXQiOjE3NDU3MzkwNzN9.UNRFdlSDd4YDBCeEHkN_o1NQD7thLHPgPc97eYEa4-8";

const siteIdAssetId = 3374925;
const siteIdAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxYTQzMGJmNS03N2VjLTQ2MWMtOGVjZC1lZTdhNzdjMTAzNTkiLCJpZCI6Mjk0MTA5LCJpYXQiOjE3NDcxNDYzOTl9.ayGRfH5quHXV33UToFnG87aq2CJs6x5T7fCc-UniOMU";

const networkComplainAssetId = 3455048;
const networkComplainAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3YTJkZmYyZC05MDBmLTQ4OGUtOWM3Ni0xNGM2ZjMyYmJmZTkiLCJpZCI6Mjk0MTA5LCJpYXQiOjE3NDk2MTY3MjB9.1O7fV6DeZYV8fRuzOoPlzR7mAF3hV5Plt9KFbR1nTEw";

let firstAntennaPosition = null;
const processedSiteIds = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  console.log("⏳ Waiting for TerriaMap...");
  const waitForTerria = setInterval(async () => {
    if (window.terria && window.terria.currentViewer?.scene?.primitives) {
      clearInterval(waitForTerria);
      console.log("✅ TerriaMap instance is ready:", window.terria);
      await loadSiteGeoJSON(window.terria);
      await loadTicketGeoJSON();
      await loadSiteIdGeoJSON(); // ✅ Ensure new dataset is loaded too
      await loadNetworkComplainGeoJSON();
    }
  }, 500);
});

async function loadSiteIdGeoJSON() {
  console.log("📡 Fetching SiteID GeoJSON…");
  try {
    // 👉 Pass token directly
    const resource = await Cesium.IonResource.fromAssetId(siteIdAssetId, {
      accessToken: siteIdAccessToken
    });

    // Fetch the data
    window.siteIdGeoJsonData = await resource.fetchJson();

    console.log(
      `✅ SiteID GeoJSON loaded. Features: ${window.siteIdGeoJsonData.features.length}`
    );
  } catch (error) {
    console.error("❌ Error loading SiteID GeoJSON:", error);
  }
}

async function loadNetworkComplainGeoJSON() {
  console.log("📡 Fetching Network Complain 2 GeoJSON…");
  try {
    // 👉 Pass the token directly instead of relying on Cesium.Ion.defaultAccessToken
    const resource = await Cesium.IonResource.fromAssetId(
      networkComplainAssetId,
      { accessToken: networkComplainAccessToken }
    );

    // Fetch the GeoJSON once the resource is ready
    window.networkComplainData = await resource.fetchJson();

    console.log(
      `✅ Network Complain 2 GeoJSON loaded. Features: ${window.networkComplainData.features.length}`
    );
  } catch (error) {
    console.error("❌ Error loading Network Complain 2 GeoJSON:", error);
  }
}
// ──────────────────────────────────────────────────────────────
async function loadSiteGeoJSON(terria) {
  console.log("📡 Fetching Site GeoJSON…");
  try {
    // 👉 Pass token directly
    const resource = await Cesium.IonResource.fromAssetId(siteGeoJsonAssetId, {
      accessToken: siteAccessToken
    });

    window.siteGeoJsonData = await resource.fetchJson();
    console.log(
      `✅ Site GeoJSON loaded. Features: ${siteGeoJsonData.features.length}`
    );

    if (!terria.currentViewer?.scene?.primitives) {
      console.error("❌ Scene primitives unavailable.");
      return;
    }

    // ↘️  Your existing loop to drop the antenna models
    for (const feature of siteGeoJsonData.features) {
      const { geometry, properties } = feature;
      const [longitude, latitude] = geometry.coordinates;
      const siteId = properties["siteid"];
      if (processedSiteIds.has(siteId)) continue;
      processedSiteIds.add(siteId);

      const terrainHeight = await getTerrainHeight(longitude, latitude);
      const position = Cesium.Cartesian3.fromDegrees(
        longitude,
        latitude,
        terrainHeight
      );
      const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position);

      try {
        // (you can also inline the token here if this asset is private)
        const modelResource = await Cesium.IonResource.fromAssetId(3124907);
        const modelEntity = Cesium.Model.fromGltf({
          url: modelResource,
          modelMatrix,
          scale: 1
        });
        terria.currentViewer.scene.primitives.add(modelEntity);
      } catch (error) {
        console.error("❌ Model load failed:", error);
      }
    }

    if (firstAntennaPosition) {
      flyToFirstAntenna(terria, firstAntennaPosition);
    }
  } catch (error) {
    console.error("❌ Error loading Site GeoJSON:", error);
  }
}

async function loadTicketGeoJSON() {
  console.log("📡 Fetching Ticket GeoJSON…");
  try {
    // 👉 Pass token directly
    const resource = await Cesium.IonResource.fromAssetId(
      ticketGeoJsonAssetId,
      { accessToken: ticketAccessToken }
    );

    window.ticketGeoJsonData = await resource.fetchJson();

    console.log(
      `✅ Ticket GeoJSON loaded. Features: ${window.ticketGeoJsonData.features.length}`
    );
  } catch (error) {
    console.error("❌ Error loading Ticket GeoJSON:", error);
  }
}

// ✅ Unified Fly to Site ID (New + Legacy datasets)
window.flyToSiteID = function (siteID) {
  console.log(`🚀 flyToSiteID triggered for: ${siteID}`);

  let dataset = null;

  // Check new Site ID dataset
  if (window.siteIdGeoJsonData) {
    dataset = window.siteIdGeoJsonData.features.find(
      (feature) =>
        feature.properties["siteid"]?.toString().toUpperCase() ===
        siteID.toUpperCase()
    );
  }

  // Fallback to legacy dataset
  if (!dataset && window.siteGeoJsonData) {
    dataset = window.siteGeoJsonData.features.find(
      (feature) =>
        feature.properties["siteid"]?.toString().toUpperCase() ===
        siteID.toUpperCase()
    );
  }

  if (!dataset) {
    console.warn(`⚠️ Site ID ${siteID} not found in any dataset.`);
    return;
  }

  const [longitude, latitude] = dataset.geometry.coordinates;
  flyCameraTo(longitude, latitude);
};

// ✅ Fly to Ticket ID (already working)
window.flyToTicketLocation = function (ticketID) {
  console.log(`🚀 flyToTicketLocation triggered for: ${ticketID}`);

  if (!window.ticketGeoJsonData) {
    console.error("❌ Ticket GeoJSON not loaded.");
    return;
  }

  const ticketFeature = window.ticketGeoJsonData.features.find(
    (feature) =>
      feature.properties["Ticket ID"]?.toString().toLowerCase() ===
      ticketID.toLowerCase()
  );

  if (!ticketFeature) {
    console.warn(`⚠️ Ticket ID ${ticketID} not found.`);
    return;
  }

  const [longitude, latitude] = ticketFeature.geometry.coordinates;
  flyCameraTo(longitude, latitude);
};

window.flyToNetworkComplain2 = function (ticketID) {
  console.log(`🚀 flyToNetworkComplain2 triggered for: ${ticketID}`);

  if (!window.networkComplainData) {
    console.error("❌ networkComplain2longlat GeoJSON not loaded.");
    return;
  }

  const feature = window.networkComplainData.features.find(
    (f) =>
      f.properties["Ticket ID"]?.toString().toLowerCase() ===
      ticketID.toLowerCase()
  );

  if (!feature) {
    console.warn(
      `⚠️ Ticket ID ${ticketID} not found in networkComplain2longlat.`
    );
    return;
  }

  const [longitude, latitude] = feature.geometry.coordinates;
  flyCameraTo(longitude, latitude);
};

// Universal Fly-to Camera
function flyCameraTo(longitude, latitude) {
  if (!window.terria?.currentViewer?.scene) {
    console.error("❌ Cesium scene not ready.");
    return;
  }

  window.terria.currentViewer.scene.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 1000),
    duration: 2,
    orientation: { heading: 0, pitch: -1.5, roll: 0 }
  });

  console.log("✅ Camera movement triggered!");
}

// Terrain Height Utility
async function getTerrainHeight(longitude, latitude) {
  const scene = window.terria?.currentViewer?.scene;
  if (!scene) return 0;
  const terrainProvider = scene.terrainProvider;
  const positions = [Cesium.Cartographic.fromDegrees(longitude, latitude)];
  try {
    const heights = await Cesium.sampleTerrainMostDetailed(
      terrainProvider,
      positions
    );
    return heights[0]?.height || 0;
  } catch {
    return 0;
  }
}

// Fly to First Antenna Location
function flyToFirstAntenna(terria, position) {
  terria.currentViewer.scene.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      position.longitude,
      position.latitude,
      Math.max(position.height + 50, 100)
    ),
    duration: 3,
    orientation: { heading: 0, pitch: -0.5, roll: 0 }
  });
}
