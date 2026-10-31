

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';

const CLOUDINARY_CLOUD_NAME = 'jhj9yzbl';
const CLOUDINARY_UPLOAD_PRESET = 'pujarigo-products';

type Product = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  image_url?: string;
  stock: number;
  weight_grams?: number;
  is_available: boolean;
};

export default function SellerProductsScreen() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Puja Samagri');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [weightGrams, setWeightGrams] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<any>(null);

  const loadProducts = useCallback(async () => {
    try {
      const response = await apiClient.get('/store/seller/products');
      setProducts(Array.isArray(response) ? response : []);
    } catch (error: any) {
      Alert.alert(
        'Unable to load products',
        error?.message || 'Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setCategory('Puja Samagri');
    setPrice('');
    setStock('');
    setWeightGrams('');
    setImageUrl('');
    setSelectedImageUri('');
    setSelectedImageFile(null);
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setName(product.name || '');
    setDescription(product.description || '');
    setCategory(product.category || 'Puja Samagri');
    setPrice(String(product.price ?? ''));
    setStock(String(product.stock ?? ''));
    setWeightGrams(String(product.weight_grams ?? ''));
    setImageUrl(product.image_url || '');
    setSelectedImageUri('');
    setSelectedImageFile(null);
  };

  const choosePhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Photo permission needed',
          'Allow photo library access to choose a product image.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      setSelectedImageUri(asset.uri);
      setSelectedImageFile((asset as any).file || null);
    } catch (error: any) {
      Alert.alert(
        'Could not select photo',
        error?.message || 'Please try again.'
      );
    }
  };

  const uploadPhoto = async (): Promise<string> => {
    if (!selectedImageUri) {
      return imageUrl.trim();
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();

      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', 'pujarigo-products');

      if (Platform.OS === 'web' && selectedImageFile) {
        formData.append('file', selectedImageFile);
      } else {
        const fileResponse = await fetch(selectedImageUri);
        const blob = await fileResponse.blob();

        formData.append(
          'file',
          blob,
          `pujarigo-${Date.now()}.jpg`
        );
      }

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.secure_url) {
        throw new Error(
          result?.error?.message || 'Cloudinary could not upload the photo.'
        );
      }

      return result.secure_url;
    } finally {
      setUploadingImage(false);
    }
  };

  const saveProduct = async () => {
    const cleanName = name.trim();
    const cleanPrice = Number(price);
    const cleanStock = Number(stock);
    const cleanWeight = Number(weightGrams);

    if (!cleanName) {
      Alert.alert('Missing name', 'Please enter the product name.');
      return;
    }

    if (!price.trim() || !Number.isFinite(cleanPrice) || cleanPrice <= 0) {
      Alert.alert('Invalid price', 'Enter a price greater than zero.');
      return;
    }

    if (
  !weightGrams.trim() ||
  !Number.isInteger(cleanWeight) ||
  cleanWeight <= 0 ||
  cleanWeight > 100000
) {
  Alert.alert(
    'Invalid weight',
    'Enter a whole number of grams greater than 0.'
  );
  return;
}

    setSaving(true);

    try {
      const uploadedImageUrl = await uploadPhoto();

      const payload = {
        name: cleanName,
        description: description.trim(),
        category: category.trim() || 'Puja Samagri',
        price: cleanPrice,
        stock: cleanStock,
        weight_grams: cleanWeight,
        image_url: uploadedImageUrl,
        is_available: cleanStock > 0,
      };

      if (editingId) {
        await apiClient.put(
          `/store/seller/products/${editingId}`,
          payload
        );
        Alert.alert('Success', 'Product updated successfully.');
      } else {
        await apiClient.post('/store/seller/products', payload);
        Alert.alert('Success', 'Product added successfully.');
      }

      resetForm();
      await loadProducts();
    } catch (error: any) {
      Alert.alert(
        'Could not save product',
        error?.message || 'Please check your details and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const hideProduct = (product: Product) => {
    Alert.alert(
      'Hide product?',
      `Hide "${product.name}" from the customer store?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(
                `/store/seller/products/${product.id}`
              );
              Alert.alert('Success', 'Product hidden from customers.');
              await loadProducts();
            } catch (error: any) {
              Alert.alert(
                'Could not hide product',
                error?.message || 'Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#2874F0"
          style={{ marginTop: 50 }}
        />
        <Text style={styles.loadingText}>Loading your products...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProducts();
            }}
          />
        }
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#172B4D" />
          <Text style={styles.backText}>Seller Dashboard</Text>
        </TouchableOpacity>

        <Text style={styles.title}>My Products</Text>
        <Text style={styles.subtitle}>
          Add and manage the products in your shop.
        </Text>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {editingId ? 'Edit Product' : 'Add New Product'}
          </Text>

          <Text style={styles.label}>Product name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Puja Thali"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your product"
            multiline
          />

          <Text style={styles.label}>Category</Text>
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="Puja Samagri"
          />

          <Text style={styles.label}>Price (₹) *</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="Enter price"
            keyboardType="decimal-pad"
          />

         <Text style={styles.label}>Weight in grams *</Text>
<TextInput
  style={styles.input}
  value={weightGrams}
  onChangeText={setWeightGrams}
  placeholder="Enter weight in grams"
  keyboardType="number-pad"
/>

<Text style={styles.label}>Stock quantity *</Text>
<TextInput
  style={styles.input}
  value={stock}
  onChangeText={setStock}
  placeholder="Enter stock"
  keyboardType="number-pad"
/>
          <Text style={styles.label}>Product photo</Text>

          {(selectedImageUri || imageUrl) ? (
            <Image
              source={{ uri: selectedImageUri || imageUrl }}
              style={styles.photoPreview}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="image-outline" size={42} color="#98A2B3" />
              <Text style={styles.photoPlaceholderText}>
                No product photo selected
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.photoButton}
            onPress={choosePhoto}
            disabled={saving || uploadingImage}
          >
            <Ionicons name="images-outline" size={21} color="#2874F0" />
            <Text style={styles.photoButtonText}>
              {selectedImageUri || imageUrl
                ? 'Choose Another Photo'
                : 'Choose Photo from Gallery'}
            </Text>
          </TouchableOpacity>

          {(selectedImageUri || imageUrl) ? (
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => {
                setSelectedImageUri('');
                setSelectedImageFile(null);
                setImageUrl('');
              }}
              disabled={saving || uploadingImage}
            >
              <Text style={styles.removePhotoText}>Remove Photo</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.helper}>
            Photos are uploaded to Cloudinary when you save the product.
          </Text>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (saving || uploadingImage) && styles.disabledButton,
            ]}
            onPress={saveProduct}
            disabled={saving || uploadingImage}
          >
            {saving || uploadingImage ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {uploadingImage ? 'Uploading photo...' : 'Saving product...'}
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name={editingId ? 'save-outline' : 'add-circle-outline'}
                  size={21}
                  color="#FFFFFF"
                />
                <Text style={styles.saveButtonText}>
                  {editingId ? 'Save Changes' : 'Add Product'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {editingId && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={resetForm}
              disabled={saving || uploadingImage}
            >
              <Text style={styles.cancelText}>Cancel Editing</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.listTitle}>
          Your Products ({products.length})
        </Text>

        {products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={42} color="#98A2B3" />
            <Text style={styles.emptyTitle}>No products yet</Text>
            <Text style={styles.emptyText}>
              Add your first product using the form above.
            </Text>
          </View>
        ) : (
          products.map((product) => (
            <View key={product.id} style={styles.productCard}>
              {product.image_url ? (
                <Image
                  source={{ uri: product.image_url }}
                  style={styles.productThumbnail}
                  resizeMode="cover"
                />
              ) : null}

              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productCategory}>
                  {product.category || 'Puja Samagri'}
                </Text>
                <Text style={styles.productPrice}>
                  ₹{Number(product.price || 0).toFixed(2)}
                </Text>
                <Text style={styles.productStock}>
                  Stock: {product.stock}
                </Text>
                <Text style={styles.productStock}>
  Weight: {product.weight_grams ?? '—'} g
</Text>
                <Text
                  style={[
                    styles.status,
                    product.is_available
                      ? styles.available
                      : styles.hidden,
                  ]}
                >
                  {product.is_available ? 'Available' : 'Hidden'}
                </Text>
              </View>

              <View style={styles.productActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => startEdit(product)}
                >
                  <Ionicons name="create-outline" size={18} color="#2874F0" />
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>

                {product.is_available && (
                  <TouchableOpacity
                    style={styles.hideButton}
                    onPress={() => hideProduct(product)}
                  >
                    <Ionicons
                      name="eye-off-outline"
                      size={18}
                      color="#D92D20"
                    />
                    <Text style={styles.hideText}>Hide</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backText: {
    color: '#172B4D',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  title: {
    fontSize: 27,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  subtitle: {
    fontSize: 14,
    color: '#667085',
    marginTop: 6,
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 17,
    marginBottom: 28,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#172B4D',
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 7,
    marginTop: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    color: '#172B4D',
  },
  multiline: {
    minHeight: 85,
    textAlignVertical: 'top',
  },
  photoPreview: {
    width: 160,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#F2F4F7',
    alignSelf: 'center',
    marginVertical: 12,
  },
  photoPlaceholder: {
    minHeight: 145,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D0D5DD',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  photoPlaceholderText: {
    color: '#667085',
    fontSize: 13,
    marginTop: 8,
  },
  photoButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#2874F0',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EAF2FF',
    marginTop: 4,
  },
  photoButtonText: {
    color: '#2874F0',
    fontSize: 14,
    fontWeight: '700',
  },
  removePhotoButton: {
    alignItems: 'center',
    padding: 10,
  },
  removePhotoText: {
    color: '#D92D20',
    fontWeight: '600',
  },
  helper: {
    color: '#667085',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#2874F0',
    minHeight: 50,
    borderRadius: 10,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 13,
    marginTop: 4,
  },
  cancelText: {
    color: '#667085',
    fontWeight: '600',
  },
  listTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#172B4D',
    marginBottom: 14,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#344054',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#667085',
    marginTop: 7,
    textAlign: 'center',
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    alignItems: 'center',
  },
  productThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F2F4F7',
  },
  productInfo: {
    flex: 1,
    paddingRight: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  productCategory: {
    color: '#667085',
    fontSize: 12,
    marginTop: 4,
  },
  productPrice: {
    color: '#172B4D',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 7,
  },
  productStock: {
    color: '#667085',
    fontSize: 12,
    marginTop: 4,
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  available: {
    color: '#16803D',
  },
  hidden: {
    color: '#D92D20',
  },
  productActions: {
    alignItems: 'stretch',
    gap: 10,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#EAF2FF',
  },
  editText: {
    color: '#2874F0',
    fontWeight: '600',
    fontSize: 13,
  },
  hideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#FEF3F2',
  },
  hideText: {
    color: '#D92D20',
    fontWeight: '600',
    fontSize: 13,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 12,
    color: '#667085',
  },
});
