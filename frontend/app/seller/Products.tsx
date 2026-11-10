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
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  is_available: boolean;
  is_returnable: boolean;
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
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<any>(null);
  const [isReturnable, setIsReturnable] = useState(false);

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
    setLengthCm('');
    setWidthCm('');
    setHeightCm('');
    setImageUrl('');
    setSelectedImageUri('');
    setSelectedImageFile(null);
    setIsReturnable(false);
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setName(product.name || '');
    setDescription(product.description || '');
    setCategory(product.category || 'Puja Samagri');
    setPrice(String(product.price ?? ''));
    setStock(String(product.stock ?? ''));
    setWeightGrams(String(product.weight_grams ?? ''));
    setLengthCm(String(product.length_cm ?? ''));
    setWidthCm(String(product.width_cm ?? ''));
    setHeightCm(String(product.height_cm ?? ''));
    setImageUrl(product.image_url || '');
    setSelectedImageUri('');
    setSelectedImageFile(null);
    setIsReturnable(product.is_returnable ?? false);
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
          result?.error?.message ||
            'Cloudinary could not upload the photo.'
        );
      }

      return result.secure_url;
    } finally {
      setUploadingImage(false);
    }
  };

  const validateNumber = (
    value: string,
    label: string,
    max: number,
    integerOnly = false
  ) => {
    const number = Number(value);

    if (!value.trim()) {
      Alert.alert(`Invalid ${label}`, `Enter ${label}.`);
      return null;
    }

    if (
      !Number.isFinite(number) ||
      number <= 0 ||
      number > max ||
      (integerOnly && !Number.isInteger(number))
    ) {
      Alert.alert(
        `Invalid ${label}`,
        integerOnly
          ? `Enter a whole number greater than 0 and up to ${max}.`
          : `Enter a number greater than 0 and up to ${max}.`
      );
      return null;
    }

    return number;
  };

  const saveProduct = async () => {
    const cleanName = name.trim();
    const cleanCategory = category.trim() || 'Puja Samagri';

    if (!cleanName) {
      Alert.alert('Missing name', 'Please enter the product name.');
      return;
    }

    const cleanPrice = validateNumber(price, 'price', 10000000);
    if (cleanPrice === null) return;

    const cleanStock = Number(stock);

    if (
      !stock.trim() ||
      !Number.isInteger(cleanStock) ||
      cleanStock < 0 ||
      cleanStock > 1000000
    ) {
      Alert.alert(
        'Invalid stock',
        'Enter a whole number from 0 to 1,000,000.'
      );
      return;
    }

    const cleanWeight = validateNumber(
      weightGrams,
      'weight',
      100000,
      true
    );
    if (cleanWeight === null) return;

    const cleanLength = validateNumber(
      lengthCm,
      'length',
      500
    );
    if (cleanLength === null) return;

    const cleanWidth = validateNumber(
      widthCm,
      'width',
      500
    );
    if (cleanWidth === null) return;

    const cleanHeight = validateNumber(
      heightCm,
      'height',
      500
    );
    if (cleanHeight === null) return;

    setSaving(true);

    try {
      const uploadedImageUrl = await uploadPhoto();

      const payload = {
        name: cleanName,
        description: description.trim(),
        category: cleanCategory,
        price: cleanPrice,
        stock: cleanStock,
        weight_grams: cleanWeight,
        length_cm: cleanLength,
        width_cm: cleanWidth,
        height_cm: cleanHeight,
        image_url: uploadedImageUrl,
        is_available: cleanStock > 0,
        is_returnable: isReturnable,
      };

      if (editingId) {
        await apiClient.put(
          `/store/seller/products/${editingId}`,
          payload
        );

        Alert.alert(
          'Product updated',
          'Your product details have been updated successfully.'
        );
      } else {
        await apiClient.post(
          '/store/seller/products',
          payload
        );

        Alert.alert(
          'Product added',
          'Your product is now added to your shop.'
        );
      }

      resetForm();
      await loadProducts();
    } catch (error: any) {
      Alert.alert(
        'Could not save product',
        error?.message ||
          'Please check your details and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const hideProduct = (product: Product) => {
    Alert.alert(
      'Hide product?',
      `Hide "${product.name}" from customers?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(
                `/store/seller/products/${product.id}`
              );

              Alert.alert(
                'Product hidden',
                'Customers can no longer see this product.'
              );

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

  const showProduct = (product: Product) => {
    if (Number(product.stock || 0) <= 0) {
      Alert.alert(
        'Add stock first',
        'Increase the stock quantity before making this product available.'
      );
      return;
    }

    Alert.alert(
      'Show product?',
      `Show "${product.name}" to customers again?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Show Product',
          onPress: async () => {
            try {
              await apiClient.put(
                `/store/seller/products/${product.id}`,
                {
                  name: product.name,
                  description: product.description || '',
                  category: product.category || 'Puja Samagri',
                  price: Number(product.price),
                  stock: Number(product.stock),
                  weight_grams: Number(product.weight_grams),
                  length_cm: Number(product.length_cm),
                  width_cm: Number(product.width_cm),
                  height_cm: Number(product.height_cm),
                  image_url: product.image_url || '',
                  is_available: true,
                  is_returnable: product.is_returnable,
                }
              );

              Alert.alert(
                'Product visible',
                'The product is available to customers again.'
              );

              await loadProducts();
            } catch (error: any) {
              Alert.alert(
                'Could not show product',
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

        <Text style={styles.loadingText}>
          Loading your products...
        </Text>
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
          <Ionicons
            name="arrow-back"
            size={22}
            color="#172B4D"
          />

          <Text style={styles.backText}>
            Seller Dashboard
          </Text>
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              My Products
            </Text>

            <Text style={styles.subtitle}>
              Add, edit and manage the products in your shop.
            </Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {products.length}
            </Text>

            <Text style={styles.countLabel}>
              Products
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formTitle}>
                {editingId
                  ? 'Edit Product'
                  : 'Add New Product'}
              </Text>

              <Text style={styles.formSubtitle}>
                Keep product, stock and parcel details accurate.
              </Text>
            </View>

            {editingId && (
              <View style={styles.editingBadge}>
                <Ionicons
                  name="create-outline"
                  size={14}
                  color="#2874F0"
                />

                <Text style={styles.editingBadgeText}>
                  Editing
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>
            Basic Information
          </Text>

          <Text style={styles.label}>
            Product name *
          </Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Puja Thali"
            placeholderTextColor="#98A2B3"
          />

          <Text style={styles.label}>
            Description
          </Text>

          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your product"
            placeholderTextColor="#98A2B3"
            multiline
          />

          <Text style={styles.label}>
            Category
          </Text>

          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="Puja Samagri"
            placeholderTextColor="#98A2B3"
          />

          <Text style={styles.sectionTitle}>
            Price & Stock
          </Text>

          <Text style={styles.label}>
            Price (₹) *
          </Text>

          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="Enter price"
            placeholderTextColor="#98A2B3"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>
            Stock quantity *
          </Text>

          <TextInput
            style={styles.input}
            value={stock}
            onChangeText={setStock}
            placeholder="Enter stock quantity"
            placeholderTextColor="#98A2B3"
            keyboardType="number-pad"
          />

          <Text style={styles.helper}>
            Set stock to 0 when the product has no inventory.
            The product will automatically become unavailable.
          </Text>

          <Text style={styles.sectionTitle}>
            Parcel Information
          </Text>

          <Text style={styles.label}>
            Weight in grams *
          </Text>

          <TextInput
            style={styles.input}
            value={weightGrams}
            onChangeText={setWeightGrams}
            placeholder="e.g. 500"
            placeholderTextColor="#98A2B3"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>
            Package length (cm) *
          </Text>

          <TextInput
            style={styles.input}
            value={lengthCm}
            onChangeText={setLengthCm}
            placeholder="e.g. 20"
            placeholderTextColor="#98A2B3"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>
            Package width (cm) *
          </Text>

          <TextInput
            style={styles.input}
            value={widthCm}
            onChangeText={setWidthCm}
            placeholder="e.g. 15"
            placeholderTextColor="#98A2B3"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>
            Package height (cm) *
          </Text>

          <TextInput
            style={styles.input}
            value={heightCm}
            onChangeText={setHeightCm}
            placeholder="e.g. 10"
            placeholderTextColor="#98A2B3"
            keyboardType="decimal-pad"
          />

          <View style={styles.infoBox}>
            <Ionicons
              name="cube-outline"
              size={19}
              color="#2874F0"
            />

            <Text style={styles.infoText}>
              Enter the packed parcel dimensions, not only
              the product dimensions. These values are saved
              with the product.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>
            Return Policy
          </Text>

          <View style={styles.row}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                isReturnable &&
                  styles.optionButtonActive,
              ]}
              onPress={() => setIsReturnable(true)}
            >
              <Ionicons
                name={
                  isReturnable
                    ? 'radio-button-on'
                    : 'radio-button-off'
                }
                size={18}
                color={
                  isReturnable
                    ? '#2874F0'
                    : '#667085'
                }
              />

              <Text
                style={[
                  styles.optionText,
                  isReturnable &&
                    styles.optionTextActive,
                ]}
              >
                Returnable
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,
                !isReturnable &&
                  styles.optionButtonActive,
              ]}
              onPress={() => setIsReturnable(false)}
            >
              <Ionicons
                name={
                  !isReturnable
                    ? 'radio-button-on'
                    : 'radio-button-off'
                }
                size={18}
                color={
                  !isReturnable
                    ? '#2874F0'
                    : '#667085'
                }
              />

              <Text
                style={[
                  styles.optionText,
                  !isReturnable &&
                    styles.optionTextActive,
                ]}
              >
                Non-returnable
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>
            Product Photo
          </Text>

          {selectedImageUri || imageUrl ? (
            <Image
              source={{
                uri:
                  selectedImageUri || imageUrl,
              }}
              style={styles.photoPreview}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons
                name="image-outline"
                size={42}
                color="#98A2B3"
              />

              <Text
                style={styles.photoPlaceholderText}
              >
                No product photo selected
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.photoButton}
            onPress={choosePhoto}
            disabled={
              saving || uploadingImage
            }
          >
            <Ionicons
              name="images-outline"
              size={21}
              color="#2874F0"
            />

            <Text style={styles.photoButtonText}>
              {selectedImageUri || imageUrl
                ? 'Choose Another Photo'
                : 'Choose Photo from Gallery'}
            </Text>
          </TouchableOpacity>

          {(selectedImageUri || imageUrl) && (
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => {
                setSelectedImageUri('');
                setSelectedImageFile(null);
                setImageUrl('');
              }}
              disabled={
                saving || uploadingImage
              }
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color="#D92D20"
              />

              <Text style={styles.removePhotoText}>
                Remove Photo
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.helper}>
            Photos are uploaded to Cloudinary when you
            save the product.
          </Text>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (saving || uploadingImage) &&
                styles.disabledButton,
            ]}
            onPress={saveProduct}
            disabled={
              saving || uploadingImage
            }
          >
            {saving || uploadingImage ? (
              <>
                <ActivityIndicator color="#FFFFFF" />

                <Text style={styles.saveButtonText}>
                  {uploadingImage
                    ? 'Uploading photo...'
                    : 'Saving product...'}
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name={
                    editingId
                      ? 'save-outline'
                      : 'add-circle-outline'
                  }
                  size={21}
                  color="#FFFFFF"
                />

                <Text style={styles.saveButtonText}>
                  {editingId
                    ? 'Save Changes'
                    : 'Add Product'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {editingId && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={resetForm}
              disabled={
                saving || uploadingImage
              }
            >
              <Text style={styles.cancelText}>
                Cancel Editing
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>
              Your Products
            </Text>

            <Text style={styles.listSubtitle}>
              Manage availability, stock and product details.
            </Text>
          </View>

          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>
              {products.length}
            </Text>
          </View>
        </View>

        {products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="cube-outline"
              size={42}
              color="#98A2B3"
            />

            <Text style={styles.emptyTitle}>
              No products yet
            </Text>

            <Text style={styles.emptyText}>
              Add your first product using the form above.
            </Text>
          </View>
        ) : (
          products.map((product) => (
            <View
              key={product.id}
              style={styles.productCard}
            >
              {product.image_url ? (
                <Image
                  source={{
                    uri: product.image_url,
                  }}
                  style={styles.productThumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={styles.productThumbnailEmpty}
                >
                  <Ionicons
                    name="image-outline"
                    size={25}
                    color="#98A2B3"
                  />
                </View>
              )}

              <View style={styles.productInfo}>
                <View style={styles.productTopRow}>
                  <Text
                    style={styles.productName}
                    numberOfLines={2}
                  >
                    {product.name}
                  </Text>

                  <View
                    style={[
                      styles.statusPill,
                      product.is_available
                        ? styles.availablePill
                        : styles.hiddenPill,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        product.is_available
                          ? styles.availableDot
                          : styles.hiddenDot,
                      ]}
                    />

                    <Text
                      style={[
                        styles.statusPillText,
                        product.is_available
                          ? styles.availableText
                          : styles.hiddenText,
                      ]}
                    >
                      {product.is_available
                        ? 'Live'
                        : 'Hidden'}
                    </Text>
                  </View>
                </View>

                <Text
                  style={styles.productCategory}
                >
                  {product.category ||
                    'Puja Samagri'}
                </Text>

                <Text
                  style={styles.productPrice}
                >
                  ₹
                  {Number(
                    product.price || 0
                  ).toFixed(2)}
                </Text>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Ionicons
                      name="layers-outline"
                      size={14}
                      color="#667085"
                    />

                    <Text
                      style={styles.statText}
                    >
                      Stock {product.stock}
                    </Text>
                  </View>

                  <View style={styles.statItem}>
                    <Ionicons
                      name="scale-outline"
                      size={14}
                      color="#667085"
                    />

                    <Text
                      style={styles.statText}
                    >
                      {product.weight_grams ??
                        '—'}{' '}
                      g
                    </Text>
                  </View>
                </View>

                <View style={styles.dimensionRow}>
                  <Ionicons
                    name="resize-outline"
                    size={14}
                    color="#667085"
                  />

                  <Text
                    style={styles.dimensionText}
                  >
                    {product.length_cm ??
                      '—'}{' '}
                    ×{' '}
                    {product.width_cm ??
                      '—'}{' '}
                    ×{' '}
                    {product.height_cm ??
                      '—'}{' '}
                    cm
                  </Text>
                </View>

                <Text
                  style={[
                    styles.returnText,
                    product.is_returnable
                      ? styles.returnAllowed
                      : styles.returnNotAllowed,
                  ]}
                >
                  {product.is_returnable
                    ? '7-day return eligible'
                    : 'Non-returnable'}
                </Text>
              </View>

              <View
                style={styles.productActions}
              >
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() =>
                    startEdit(product)
                  }
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color="#2874F0"
                  />

                  <Text
                    style={styles.editText}
                  >
                    Edit
                  </Text>
                </TouchableOpacity>

                {product.is_available ? (
                  <TouchableOpacity
                    style={styles.hideButton}
                    onPress={() =>
                      hideProduct(product)
                    }
                  >
                    <Ionicons
                      name="eye-off-outline"
                      size={18}
                      color="#D92D20"
                    />

                    <Text
                      style={styles.hideText}
                    >
                      Hide
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.showButton}
                    onPress={() =>
                      showProduct(product)
                    }
                  >
                    <Ionicons
                      name="eye-outline"
                      size={18}
                      color="#16803D"
                    />

                    <Text
                      style={styles.showText}
                    >
                      Show
                    </Text>
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
    paddingBottom: 50,
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

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
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
    maxWidth: 650,
  },

  countBadge: {
    minWidth: 62,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    marginLeft: 10,
  },

  countText: {
    color: '#2874F0',
    fontSize: 19,
    fontWeight: 'bold',
  },

  countLabel: {
    color: '#667085',
    fontSize: 10,
    marginTop: 1,
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 17,
    marginBottom: 28,
  },

  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#172B4D',
  },

  formSubtitle: {
    color: '#667085',
    fontSize: 12,
    marginTop: 4,
  },

  editingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EAF2FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },

  editingBadgeText: {
    color: '#2874F0',
    fontSize: 11,
    fontWeight: '700',
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#172B4D',
    marginTop: 22,
    marginBottom: 4,
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

  helper: {
    color: '#667085',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F6FF',
    borderRadius: 10,
    padding: 11,
    marginTop: 12,
    gap: 8,
  },

  infoText: {
    flex: 1,
    color: '#475467',
    fontSize: 12,
    lineHeight: 18,
  },

  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },

  optionButton: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
  },

  optionButtonActive: {
    borderColor: '#2874F0',
    backgroundColor: '#EAF2FF',
  },

  optionText: {
    color: '#667085',
    fontWeight: '600',
    fontSize: 13,
  },

  optionTextActive: {
    color: '#2874F0',
  },

  photoPreview: {
    width: 170,
    height: 170,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: 10,
  },

  removePhotoText: {
    color: '#D92D20',
    fontWeight: '600',
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

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  listTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#172B4D',
  },

  listSubtitle: {
    color: '#667085',
    fontSize: 12,
    marginTop: 4,
  },

  totalBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  totalBadgeText: {
    color: '#2874F0',
    fontWeight: '800',
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
    alignItems: 'flex-start',
  },

  productThumbnail: {
    width: 76,
    height: 76,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#F2F4F7',
  },

  productThumbnailEmpty: {
    width: 76,
    height: 76,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  productInfo: {
    flex: 1,
    paddingRight: 8,
    minWidth: 0,
  },

  productTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },

  productName: {
    flex: 1,
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

  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 7,
  },

  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  statText: {
    color: '#667085',
    fontSize: 12,
  },

  dimensionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },

  dimensionText: {
    color: '#667085',
    fontSize: 12,
  },

  returnText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },

  returnAllowed: {
    color: '#16803D',
  },

  returnNotAllowed: {
    color: '#D92D20',
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  availablePill: {
    backgroundColor: '#ECFDF3',
  },

  hiddenPill: {
    backgroundColor: '#FEF3F2',
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  availableDot: {
    backgroundColor: '#16803D',
  },

  hiddenDot: {
    backgroundColor: '#D92D20',
  },

  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },

  availableText: {
    color: '#16803D',
  },

  hiddenText: {
    color: '#D92D20',
  },

  productActions: {
    alignItems: 'stretch',
    gap: 10,
    marginLeft: 5,
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

  showButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#ECFDF3',
  },

  showText: {
    color: '#16803D',
    fontWeight: '600',
    fontSize: 13,
  },

  loadingText: {
    textAlign: 'center',
    marginTop: 12,
    color: '#667085',
  },
});
