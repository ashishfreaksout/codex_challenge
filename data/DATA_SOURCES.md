# Predictive Model Data Sources

The bundled CSV files are small local samples shaped like the production inputs. They let the model run without API keys or large geospatial downloads.

Recommended production sources:

- Live incidents: San Jose 311 API or ArcGIS service request layers.
- Historical labels: San Francisco 311 cases, Oakland OAK311 call center requests, San Jose yearly 311 service request layers.
- Rainfall: NOAA nClimGrid-Daily or NOAA CDO daily precipitation station observations.
- Pavement condition: MTC Pavement Condition Index and local StreetSaver exports where available.
- Water retention: USGS 3DEP elevation-derived slope and flow accumulation, city storm drain/catch basin GIS layers, flood/drainage 311 requests.
- Impervious surface: USGS/NLCD impervious percentage and impervious descriptor.
- Soil drainage: USDA SSURGO hydrologic soil group and drainage attributes.
- Traffic load: Caltrans AADT for state routes, local traffic counts where available, or OSM road class as a fallback proxy.

`sample_bay_area_environmental_features.csv` stores pre-joined 100m-cell predictor values. A production ETL should replace it by spatially joining those source layers to the same prediction grid before training.
