// =================================================================
// 1. INPUT ASET & PENGATURAN AREA
// =================================================================

// Memanggil aset Manado langsung menggunakan Jalur Asset ID
var manado = ee.FeatureCollection('projects/gee-uas-kapita/assets/manado_boundary-1');

// Membuat peta otomatis berpusat ke wilayah Manado
Map.centerObject(manado, 12);

// Menampilkan garis batas wilayah Manado di peta
Map.addLayer(manado, {color: 'red'}, 'Batas Wilayah Manado');

// =================================================================
// 2. PEMANGGILAN CITRA SATELIT SENTINEL-2
// =================================================================

// Memanggil citra Sentinel-2 tahun 2024
var s2_2024 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(manado)
  .filterDate('2024-01-01', '2024-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 15))
  .median()
  .clip(manado);

// Memanggil citra Sentinel-2 tahun 2025
var s2_2025 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(manado)
  .filterDate('2025-01-01', '2025-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 15))
  .median()
  .clip(manado);

// Parameter visualisasi warna nyata
var visParams = {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000};
Map.addLayer(s2_2024, visParams, 'Citra Sentinel-2 2024');
Map.addLayer(s2_2025, visParams, 'Citra Sentinel-2 2025');

// =================================================================
// 3. PERHITUNGAN INDEKS VEGETASI (NDVI)
// =================================================================

var ndvi_2024 = s2_2024.normalizedDifference(['B8','B4']).rename('NDVI');
var ndvi_2025 = s2_2025.normalizedDifference(['B8','B4']).rename('NDVI');

var ndviVis = {min: 0, max: 0.8, palette: ['white', 'yellow', 'green', 'darkgreen']};
Map.addLayer(ndvi_2024, ndviVis, 'NDVI Tahun 2024');
Map.addLayer(ndvi_2025, ndviVis, 'NDVI Tahun 2025');

// Memasukkan layer NDVI ke dalam citra Sentinel-2 masing-masing tahun
var image2024 = s2_2024.addBands(ndvi_2024);
var image2025 = s2_2025.addBands(ndvi_2025);

// Tentukan daftar band prediktor (7 Band)
var bands = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'NDVI'];

// =================================================================
// 4. PREPARASI DATA SAMPEL & GABUNGAN DATASET (TRAIN/TEST 70:30)
// =================================================================

// Pastikan variabel veg_2024, nonveg_2024, veg_2025, nonveg_2025 sudah terdefinisi di bagian atas script/assets Anda
var sampel2024 = veg_2024.merge(nonveg_2024);
var sampel2025 = veg_2025.merge(nonveg_2025);

// MENYATUKAN DATASET AWAL
var semuaSampel = sampel2024.merge(sampel2025);
print('Total Seluruh Titik Sampel (2024 + 2025):', semuaSampel.size());

// Train Test Split Global menggunakan kolom acak
var random = semuaSampel.randomColumn('random');
var train = random.filter(ee.Filter.lt('random', 0.7));
var test = random.filter(ee.Filter.gte('random', 0.7));

print('Total Sampel Training (Global):', train.size());
print('Total Sampel Testing (Global):', test.size());

// Ekstrak nilai piksel citra 2024 menggunakan data training global
var training2024 = image2024.select(bands).sampleRegions({
  collection: train,
  properties: ['landcover'],
  scale: 10
});

// Ekstrak nilai piksel citra 2025 menggunakan data training global
var training2025 = image2025.select(bands).sampleRegions({
  collection: train,
  properties: ['landcover'],
  scale: 10
});

// MENYATUKAN DATA TRAINING UNTUK MODEL
var trainingGabungan = training2024.merge(training2025);
print('Total Data Training Gabungan Siap Model:', trainingGabungan.size());

// =================================================================
// 5. PROSES KLASIFIKASI RANDOM FOREST
// =================================================================

// Buat & latih algoritma Klasifikasi Random Forest menggunakan dataset yang sudah disatukan
var classifier = ee.Classifier.smileRandomForest(100).train({
  features: trainingGabungan,
  classProperty: 'landcover',
  inputProperties: bands
});

// Jalankan klasifikasi ke masing-masing tahun menggunakan model gabungan
var klasifikasi_2024 = image2024.select(bands).classify(classifier);
var klasifikasi_2025 = image2025.select(bands).classify(classifier);

// Visualisasi Hasil Klasifikasi (0 = Merah/Non-Veg, 1 = Hijau/Veg)
var classVis = {min: 0, max: 1, palette: ['red', 'green']};
Map.addLayer(klasifikasi_2024, classVis, 'Peta Klasifikasi Lahan 2024 + NDVI (RF)');
Map.addLayer(klasifikasi_2025, classVis, 'Peta Klasifikasi Lahan 2025 + NDVI (RF)');

// =================================================================
// 6. EVALUASI RANDOM FOREST (VALIDASI GLOBAL GABUNGAN)
// =================================================================

// Ekstrak data uji dari citra tahun 2024
var testing2024 = image2024.select(bands).sampleRegions({
  collection: test,
  properties: ['landcover'],
  scale: 10
});

// Ekstrak data uji dari citra tahun 2025
var testing2025 = image2025.select(bands).sampleRegions({
  collection: test,
  properties: ['landcover'],
  scale: 10
});

// MENYATUKAN DATA TESTING UNTUK VALIDASI
var testingGabungan = testing2024.merge(testing2025).classify(classifier);

// Menghitung Confusion Matrix Gabungan
var errorMatrix = testingGabungan.errorMatrix('landcover', 'classification');
var cmArray = errorMatrix.array();

// Perhitungan Parameter Akurasi
var accuracy = errorMatrix.accuracy();
var precision = ee.Number(errorMatrix.consumersAccuracy().get([0,0]));
var recall = ee.Number(errorMatrix.producersAccuracy().get([0,0]));
var f1Score = precision.multiply(recall).multiply(2).divide(precision.add(recall));

// PRINT HASIL EVALUASI MODEL GABUNGAN
print('========== HASIL EVALUASI RANDOM FOREST GABUNGAN ==========');
print('Akurasi Keseluruhan (Overall Accuracy) (%):', accuracy.multiply(100));
print('Presisi (Precision) (%):', precision.multiply(100));
print('Sensitivitas (Recall) (%):', recall.multiply(100));
print('F1 Score (%):', f1Score.multiply(100));
print('Confusion Matrix Global:');
print('          Prediksi');
print('          0     1');
print('Aktual 0 ', cmArray.get([0,0]), cmArray.get([0,1]));
print('Aktual 1 ', cmArray.get([1,0]), cmArray.get([1,1]));

// Folder tujuan utama di Google Drive dinamakan 'GEE_Manado_WebGIS'
var folderName = 'GEE_Manado_WebGIS';

// EXPORT EVALUASI GABUNGAN KE CSV
var evaluasiFC = ee.FeatureCollection([
  ee.Feature(null, {
    'Accuracy': accuracy,
    'Precision': precision,
    'Recall': recall,
    'F1_Score': f1Score
  })
]);

Export.table.toDrive({
  collection: evaluasiFC,
  description: 'Evaluasi_RF_Gabungan',
  folder: folderName,
  fileNamePrefix: 'Evaluasi_RF_Gabungan',
  fileFormat: 'CSV'
});

// =================================================================
// 7. STATISTIK PERUBAHAN VEGETASI
// =================================================================

var areaImage = ee.Image.pixelArea().rename('area');

var luasKota = areaImage.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: manado.geometry(),
  scale: 10,
  maxPixels: 1e13
});
var luasKotaHa = ee.Number(luasKota.get('area')).divide(10000);

var luasVeg2024Ha = ee.Number(areaImage.updateMask(klasifikasi_2024.eq(1)).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: manado.geometry(), scale: 10, maxPixels: 1e13
}).get('area')).divide(10000);

var luasVeg2025Ha = ee.Number(areaImage.updateMask(klasifikasi_2025.eq(1)).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: manado.geometry(), scale: 10, maxPixels: 1e13
}).get('area')).divide(10000);

var gainMask = klasifikasi_2024.eq(0).and(klasifikasi_2025.eq(1));
var gainHa = ee.Number(areaImage.updateMask(gainMask).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: manado.geometry(), scale: 10, maxPixels: 1e13
}).get('area')).divide(10000);

var lossMask = klasifikasi_2024.eq(1).and(klasifikasi_2025.eq(0));
var lossHa = ee.Number(areaImage.updateMask(lossMask).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: manado.geometry(), scale: 10, maxPixels: 1e13
}).get('area')).divide(10000);

var tetapVegHa = ee.Number(areaImage.updateMask(klasifikasi_2024.eq(1).and(klasifikasi_2025.eq(1))).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: manado.geometry(), scale: 10, maxPixels: 1e13
}).get('area')).divide(10000);

var tetapNonVegHa = ee.Number(areaImage.updateMask(klasifikasi_2024.eq(0).and(klasifikasi_2025.eq(0))).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: manado.geometry(), scale: 10, maxPixels: 1e13
}).get('area')).divide(10000);

var netChangeHa = luasVeg2025Ha.subtract(luasVeg2024Ha);
var persenPerubahan = netChangeHa.divide(luasVeg2024Ha).multiply(100);

print('Luas Kota (Ha)', luasKotaHa);
print('Vegetasi 2024 (Ha)', luasVeg2024Ha);
print('Vegetasi 2025 (Ha)', luasVeg2025Ha);
print('Gain (Ha)', gainHa);
print('Loss (Ha)', lossHa);
print('Net Change (Ha)', netChangeHa);

// EXPORT STATISTIK PERUBAHAN VEGETASI KE CSV
var statistik = ee.Feature(null, {
  'Luas_Kota_Ha': luasKotaHa,
  'Luas_Vegetasi_2024_Ha': luasVeg2024Ha,
  'Luas_Vegetasi_2025_Ha': luasVeg2025Ha,
  'Gain_Ha': gainHa,
  'Loss_Ha': lossHa,
  'Tetap_Vegetasi_Ha': tetapVegHa,
  'Tetap_NonVegetasi_Ha': tetapNonVegHa,
  'Net_Change_Ha': netChangeHa,
  'Persentase_Perubahan': persenPerubahan
});

Export.table.toDrive({
  collection: ee.FeatureCollection([statistik]),
  description: 'Statistik_Manado',
  folder: folderName,
  fileNamePrefix: 'Statistik_Manado',
  fileFormat: 'CSV'
});

// =================================================================
// 8. PROSES RASTER KE POLIGON VEKTOR (UNTUK MATERIAL WEB GIS)
// =================================================================

var vegetasi2024 = klasifikasi_2024.eq(1).selfMask();
var polygon2024 = vegetasi2024.reduceToVectors({
  geometry: manado.geometry(), scale: 10, geometryType: 'polygon', eightConnected: true, labelProperty: 'class', reducer: ee.Reducer.countEvery(), maxPixels: 1e13
});
Map.addLayer(polygon2024, {color: 'green'}, 'Polygon Vegetasi 2024');

var vegetasi2025 = klasifikasi_2025.eq(1).selfMask();
var polygon2025 = vegetasi2025.reduceToVectors({
  geometry: manado.geometry(), scale: 10, geometryType: 'polygon', eightConnected: true, labelProperty: 'class', reducer: ee.Reducer.countEvery(), maxPixels: 1e13
});
Map.addLayer(polygon2025, {color: 'darkgreen'}, 'Polygon Vegetasi 2025');

var change = klasifikasi_2025.subtract(klasifikasi_2024).rename('change');
Map.addLayer(gainMask.selfMask(), {palette:['00FF00']}, 'Gain Vegetasi');
Map.addLayer(lossMask.selfMask(), {palette:['FF0000']}, 'Loss Vegetasi');

var gainPolygon = change.eq(1).selfMask().reduceToVectors({
  bestEffort:true, geometry: manado.geometry(), scale: 10, geometryType: 'polygon', eightConnected: true, reducer: ee.Reducer.countEvery(), labelProperty: 'class', maxPixels: 1e13
});
Map.addLayer(gainPolygon, {color: 'blue'}, 'Gain Polygon');

var lossPolygon = change.eq(-1).selfMask().reduceToVectors({
  bestEffort:true, geometry: manado.geometry(), scale: 10, geometryType: 'polygon', eightConnected: true, reducer: ee.Reducer.countEvery(), labelProperty: 'class', maxPixels: 1e13
});
Map.addLayer(lossPolygon, {color: 'red'}, 'Loss Polygon');

// =================================================================
// 9. PROSES EKSPORT UTUH KE GOOGLE DRIVE
// =================================================================

Export.table.toDrive({ collection: sampel2024, description: '200_Manado_2024', folder: folderName, fileFormat: 'SHP' });
Export.table.toDrive({ collection: sampel2025, description: '200_Manado_2025', folder: folderName, fileFormat: 'SHP' });
Export.table.toDrive({ collection: sampel2024, description: 'Sampel_Titik_Manado_2024', folder: folderName, fileFormat: 'CSV' });
Export.table.toDrive({ collection: sampel2025, description: 'Sampel_Titik_Manado_2025', folder: folderName, fileFormat: 'CSV' });

Export.image.toDrive({
  image: klasifikasi_2024.toByte(), description: 'Raster_Klasifikasi_Manado_2024_NDVI', scale: 10, region: manado, maxPixels: 1e13, folder: folderName, fileFormat: 'GeoTIFF'
});
Export.image.toDrive({
  image: klasifikasi_2025.toByte(), description: 'Raster_Klasifikasi_Manado_2025_NDVI', scale: 10, region: manado, maxPixels: 1e13, folder: folderName, fileFormat: 'GeoTIFF'
});

Export.table.toDrive({ collection: polygon2024, description: 'Vegetasi_2024_GeoJSON', folder: folderName, fileFormat: 'GeoJSON' });
Export.table.toDrive({ collection: polygon2025, description: 'Vegetasi_2025_GeoJSON', folder: folderName, fileFormat: 'GeoJSON' });
Export.table.toDrive({ collection: gainPolygon, description: 'Gain_GeoJSON', folder: 'GEE_Manado', fileFormat: 'GeoJSON' });
Export.table.toDrive({ collection: lossPolygon, description: 'Loss_GeoJSON', folder: 'GEE_Manado', fileFormat: 'GeoJSON' });

// Tambahan eksport data pengujian detil untuk Google Colab
Export.table.toDrive({
  collection: testingGabungan.select(['landcover', 'classification']),
  description: 'Data_Testing_Hasil_Prediksi',
  folder: folderName,
  fileNamePrefix: 'Data_Testing_Hasil_Prediksi',
  fileFormat: 'CSV'
});