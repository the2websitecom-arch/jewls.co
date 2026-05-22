import { firebaseConfig, firebaseEnabled, localOwnerPassword, ownerEmail } from "./firebase-settings.js";

const LOCAL_KEY = "neela-jewles-shop";
const PHONE_KEY = "neela-jewles-phone";
const FIREBASE_VERSION = "10.12.5";

const ownerToggle = document.querySelector("#ownerToggle");
const ownerPanel = document.querySelector("#ownerPanel");
const loginForm = document.querySelector("#loginForm");
const ownerTools = document.querySelector("#ownerTools");
const logoutButton = document.querySelector("#logoutButton");
const passwordInput = document.querySelector("#passwordInput");
const categoryForm = document.querySelector("#categoryForm");
const categoryPhotoInput = document.querySelector("#categoryPhotoInput");
const categoryPreview = document.querySelector("#categoryPreview");
const categoryNameInput = document.querySelector("#categoryNameInput");
const saveCategoryButton = document.querySelector("#saveCategoryButton");
const productForm = document.querySelector("#productForm");
const productFormTitle = document.querySelector("#productFormTitle");
const productCategoryInput = document.querySelector("#productCategoryInput");
const productPhotoInput = document.querySelector("#productPhotoInput");
const productPreview = document.querySelector("#productPreview");
const productNameInput = document.querySelector("#productNameInput");
const priceInput = document.querySelector("#priceInput");
const phoneInput = document.querySelector("#phoneInput");
const saveProductButton = document.querySelector("#saveProductButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const statusMessage = document.querySelector("#statusMessage");
const categoryGrid = document.querySelector("#categoryGrid");
const categoryTemplate = document.querySelector("#categoryTemplate");
const categoryCount = document.querySelector("#categoryCount");
const productsSection = document.querySelector("#products");
const productGrid = document.querySelector("#productGrid");
const productTemplate = document.querySelector("#productTemplate");
const productTitle = document.querySelector("#productTitle");
const productCount = document.querySelector("#productCount");
const backToCategories = document.querySelector("#backToCategories");

let firebaseApi = null;
let firebaseReady = false;
let ownerLoggedIn = false;
let categories = [];
let products = [];
let selectedCategoryId = "";
let selectedCategoryFile = null;
let selectedCategoryPhoto = "";
let selectedProductFile = null;
let selectedProductPhoto = "";
let editingProductId = "";
let unsubscribeCategories = null;
let unsubscribeProducts = null;

const fallbackBanner =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 520'%3E%3Crect width='800' height='520' fill='%23f6e6ec'/%3E%3Ccircle cx='252' cy='244' r='128' fill='none' stroke='%23b03a55' stroke-width='38'/%3E%3Cpath d='M430 154h190l-50 212H480z' fill='%23c79a42'/%3E%3Cpath d='M110 420h580' stroke='%23731f31' stroke-width='28' stroke-linecap='round'/%3E%3C/svg%3E";

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value));
}

function buildWhatsAppUrl(product) {
  const category = categories.find((item) => item.id === product.categoryId);
  const categoryText = category ? ` from ${category.name}` : "";
  const message = `Hello, I want to order ${product.name}${categoryText} for ${formatPrice(product.price)}.`;
  return `https://wa.me/${product.phone}?text=${encodeURIComponent(message)}`;
}

function readLocalShop() {
  const saved = localStorage.getItem(LOCAL_KEY);

  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return { categories: [], products: [] };
    }
  }

  const necklaceId = makeId();
  const ringId = makeId();
  const starter = {
    categories: [
      { id: necklaceId, name: "Necklaces", image: fallbackBanner },
      { id: ringId, name: "Rings", image: fallbackBanner }
    ],
    products: [
      {
        id: makeId(),
        categoryId: necklaceId,
        name: "Temple Gold Necklace",
        price: 12499,
        phone: "919876543210",
        image: fallbackBanner
      },
      {
        id: makeId(),
        categoryId: ringId,
        name: "Ruby Ring",
        price: 3499,
        phone: "919876543210",
        image: fallbackBanner
      }
    ]
  };

  localStorage.setItem(LOCAL_KEY, JSON.stringify(starter));
  localStorage.setItem(PHONE_KEY, "919876543210");
  return starter;
}

function saveLocalShop() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ categories, products }));
}

async function setupFirebase() {
  if (!firebaseEnabled) {
    return;
  }

  const appModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
  const authModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`);
  const firestoreModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
  const storageModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-storage.js`);

  const app = appModule.initializeApp(firebaseConfig);
  const auth = authModule.getAuth(app);
  const db = firestoreModule.getFirestore(app);
  const storage = storageModule.getStorage(app);

  firebaseApi = {
    auth,
    db,
    storage,
    signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
    signOut: authModule.signOut,
    collection: firestoreModule.collection,
    addDoc: firestoreModule.addDoc,
    updateDoc: firestoreModule.updateDoc,
    deleteDoc: firestoreModule.deleteDoc,
    doc: firestoreModule.doc,
    onSnapshot: firestoreModule.onSnapshot,
    orderBy: firestoreModule.orderBy,
    query: firestoreModule.query,
    where: firestoreModule.where,
    serverTimestamp: firestoreModule.serverTimestamp,
    ref: storageModule.ref,
    uploadBytes: storageModule.uploadBytes,
    getDownloadURL: storageModule.getDownloadURL,
    deleteObject: storageModule.deleteObject
  };

  firebaseReady = true;
  listenToFirebase();
}

function listenToFirebase() {
  const categoryQuery = firebaseApi.query(
    firebaseApi.collection(firebaseApi.db, "categories"),
    firebaseApi.orderBy("createdAt", "desc")
  );
  const productQuery = firebaseApi.query(
    firebaseApi.collection(firebaseApi.db, "products"),
    firebaseApi.orderBy("createdAt", "desc")
  );

  unsubscribeCategories = firebaseApi.onSnapshot(categoryQuery, (snapshot) => {
    categories = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    renderAll();
  });

  unsubscribeProducts = firebaseApi.onSnapshot(productQuery, (snapshot) => {
    products = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    renderAll();
  });
}

function renderAll() {
  renderCategoryOptions();
  renderCategories();
  renderProducts();
}

function renderCategoryOptions() {
  productCategoryInput.innerHTML = "";

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    productCategoryInput.append(option);
  });

  if (selectedCategoryId && categories.some((category) => category.id === selectedCategoryId)) {
    productCategoryInput.value = selectedCategoryId;
  }
}

function renderCategories() {
  categoryGrid.innerHTML = "";
  categoryCount.textContent = `${categories.length} ${categories.length === 1 ? "category" : "categories"}`;

  if (categories.length === 0) {
    categoryGrid.append(emptyState("No categories yet. Owner can login and add Necklace, Bracelet, Ring, and more."));
    return;
  }

  categories.forEach((category) => {
    const card = categoryTemplate.content.firstElementChild.cloneNode(true);
    const openButton = card.querySelector(".category-open");
    const image = card.querySelector(".category-image");
    const name = card.querySelector(".category-name");
    const meta = card.querySelector(".category-meta");
    const deleteButton = card.querySelector(".category-delete");
    const total = products.filter((product) => product.categoryId === category.id).length;

    image.src = category.image || fallbackBanner;
    image.alt = category.name;
    name.textContent = category.name;
    meta.textContent = `${total} ${total === 1 ? "item" : "items"}`;
    openButton.addEventListener("click", () => openCategory(category.id));

    if (ownerLoggedIn) {
      deleteButton.classList.remove("is-hidden");
      deleteButton.addEventListener("click", () => deleteCategory(category));
    }

    categoryGrid.append(card);
  });
}

function renderProducts() {
  productGrid.innerHTML = "";

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const visibleProducts = selectedCategoryId
    ? products.filter((product) => product.categoryId === selectedCategoryId)
    : [];

  productTitle.textContent = selectedCategory ? selectedCategory.name : "Products";
  productCount.textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? "product" : "products"}`;

  if (!selectedCategoryId) {
    return;
  }

  if (visibleProducts.length === 0) {
    productGrid.append(emptyState("No products in this category yet."));
    return;
  }

  visibleProducts.forEach((product) => {
    const card = productTemplate.content.firstElementChild.cloneNode(true);
    const image = card.querySelector(".product-image");
    const title = card.querySelector("h3");
    const price = card.querySelector(".price");
    const link = card.querySelector(".whatsapp-link");
    const actions = card.querySelector(".owner-card-actions");
    const editButton = card.querySelector(".edit-button");
    const deleteButton = card.querySelector(".delete-button");

    image.src = product.image;
    image.alt = product.name;
    title.textContent = product.name;
    price.textContent = formatPrice(product.price);
    link.href = buildWhatsAppUrl(product);

    if (ownerLoggedIn) {
      actions.classList.remove("is-hidden");
      editButton.addEventListener("click", () => startEditProduct(product));
      deleteButton.addEventListener("click", () => deleteProduct(product));
    }

    productGrid.append(card);
  });
}

function emptyState(text) {
  const element = document.createElement("p");
  element.className = "empty-state";
  element.textContent = text;
  return element;
}

function openCategory(categoryId) {
  selectedCategoryId = categoryId;
  productsSection.classList.remove("is-hidden");
  renderAll();
  productsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetPreview(image, input) {
  input.value = "";
  image.removeAttribute("src");
  image.classList.add("is-hidden");
}

function readFile(input, onReady) {
  const file = input.files?.[0];

  if (!file) {
    onReady(null, "");
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => onReady(file, reader.result));
  reader.readAsDataURL(file);
}

async function uploadImage(file, folder) {
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-");
  const imagePath = `${folder}/${Date.now()}-${safeName}`;
  const imageRef = firebaseApi.ref(firebaseApi.storage, imagePath);
  await firebaseApi.uploadBytes(imageRef, file);
  return {
    image: await firebaseApi.getDownloadURL(imageRef),
    imagePath
  };
}

async function deleteStoredImage(path) {
  if (!firebaseReady || !path) {
    return;
  }

  try {
    await firebaseApi.deleteObject(firebaseApi.ref(firebaseApi.storage, path));
  } catch {
    setStatus("Deleted record. Old image could not be removed from Storage.");
  }
}

async function deleteCategory(category) {
  const categoryProducts = products.filter((product) => product.categoryId === category.id);

  if (firebaseReady) {
    await Promise.all(
      categoryProducts.map(async (product) => {
        await firebaseApi.deleteDoc(firebaseApi.doc(firebaseApi.db, "products", product.id));
        await deleteStoredImage(product.imagePath);
      })
    );
    await firebaseApi.deleteDoc(firebaseApi.doc(firebaseApi.db, "categories", category.id));
    await deleteStoredImage(category.imagePath);
  } else {
    products = products.filter((product) => product.categoryId !== category.id);
    categories = categories.filter((item) => item.id !== category.id);
    saveLocalShop();
    renderAll();
  }

  if (selectedCategoryId === category.id) {
    selectedCategoryId = "";
    productsSection.classList.add("is-hidden");
  }
}

async function deleteProduct(product) {
  if (firebaseReady) {
    await firebaseApi.deleteDoc(firebaseApi.doc(firebaseApi.db, "products", product.id));
    await deleteStoredImage(product.imagePath);
  } else {
    products = products.filter((item) => item.id !== product.id);
    saveLocalShop();
    renderAll();
  }
}

function startEditProduct(product) {
  editingProductId = product.id;
  productFormTitle.textContent = "Edit product";
  productCategoryInput.value = product.categoryId;
  productNameInput.value = product.name;
  priceInput.value = product.price;
  phoneInput.value = product.phone;
  selectedProductFile = null;
  selectedProductPhoto = product.image;
  productPreview.src = product.image;
  productPreview.classList.remove("is-hidden");
  productPhotoInput.required = false;
  saveProductButton.textContent = "Update Product";
  cancelEditButton.classList.remove("is-hidden");
  ownerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEdit() {
  editingProductId = "";
  productFormTitle.textContent = "Add product";
  productForm.reset();
  phoneInput.value = localStorage.getItem(PHONE_KEY) || "919876543210";
  selectedProductFile = null;
  selectedProductPhoto = "";
  productPhotoInput.required = true;
  saveProductButton.textContent = "Save Product";
  cancelEditButton.classList.add("is-hidden");
  resetPreview(productPreview, productPhotoInput);
  renderCategoryOptions();
}

function setOwnerState(isLoggedIn) {
  ownerLoggedIn = isLoggedIn;
  loginForm.classList.toggle("is-hidden", isLoggedIn);
  ownerTools.classList.toggle("is-hidden", !isLoggedIn);
  logoutButton.classList.toggle("is-hidden", !isLoggedIn);
  ownerToggle.textContent = isLoggedIn ? "Owner Panel" : "Owner Login";
  renderAll();
}

ownerToggle.addEventListener("click", () => {
  ownerPanel.classList.toggle("is-hidden");
  ownerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

backToCategories.addEventListener("click", () => {
  selectedCategoryId = "";
  productsSection.classList.add("is-hidden");
  document.querySelector("#categories").scrollIntoView({ behavior: "smooth", block: "start" });
});

categoryPhotoInput.addEventListener("change", () => {
  readFile(categoryPhotoInput, (file, dataUrl) => {
    selectedCategoryFile = file;
    selectedCategoryPhoto = dataUrl;
    categoryPreview.src = dataUrl;
    categoryPreview.classList.toggle("is-hidden", !dataUrl);
  });
});

productPhotoInput.addEventListener("change", () => {
  readFile(productPhotoInput, (file, dataUrl) => {
    selectedProductFile = file;
    selectedProductPhoto = dataUrl;
    productPreview.src = dataUrl;
    productPreview.classList.toggle("is-hidden", !dataUrl);
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  try {
    if (firebaseReady) {
      await firebaseApi.signInWithEmailAndPassword(firebaseApi.auth, ownerEmail, passwordInput.value.trim());
    } else if (passwordInput.value.trim() !== localOwnerPassword) {
      throw new Error("Wrong password");
    }

    passwordInput.setCustomValidity("");
    passwordInput.value = "";
    setOwnerState(true);
  } catch (error) {
    passwordInput.setCustomValidity(error.message || "Wrong password");
    passwordInput.reportValidity();
  }
});

logoutButton.addEventListener("click", async () => {
  if (firebaseReady) {
    await firebaseApi.signOut(firebaseApi.auth);
  }

  setOwnerState(false);
  cancelEdit();
});

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveCategoryButton.disabled = true;
  saveCategoryButton.textContent = "Saving...";
  setStatus(firebaseReady ? "Uploading category banner..." : "Saving category...");

  try {
    const category = {
      id: makeId(),
      name: categoryNameInput.value.trim(),
      image: selectedCategoryPhoto || fallbackBanner
    };

    if (firebaseReady) {
      const imageData = selectedCategoryFile
        ? await uploadImage(selectedCategoryFile, "categories")
        : { image: fallbackBanner, imagePath: "" };
      await firebaseApi.addDoc(firebaseApi.collection(firebaseApi.db, "categories"), {
        name: category.name,
        image: imageData.image,
        imagePath: imageData.imagePath,
        createdAt: firebaseApi.serverTimestamp()
      });
    } else {
      categories = [category, ...categories];
      saveLocalShop();
      renderAll();
    }

    categoryForm.reset();
    selectedCategoryFile = null;
    selectedCategoryPhoto = "";
    resetPreview(categoryPreview, categoryPhotoInput);
    setStatus("Category saved.");
  } catch (error) {
    setStatus(error.message || "Category could not be saved.");
  } finally {
    saveCategoryButton.disabled = false;
    saveCategoryButton.textContent = "Save Category";
  }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!productCategoryInput.value) {
    setStatus("Add a category first.");
    return;
  }

  if (!editingProductId && !selectedProductFile) {
    productPhotoInput.setCustomValidity("Please add a product photo");
    productPhotoInput.reportValidity();
    return;
  }

  productPhotoInput.setCustomValidity("");
  saveProductButton.disabled = true;
  saveProductButton.textContent = editingProductId ? "Updating..." : "Saving...";
  setStatus(firebaseReady ? "Saving product to Firebase..." : "Saving product...");

  try {
    const phone = phoneInput.value.replace(/[^\d]/g, "");
    const existingProduct = products.find((product) => product.id === editingProductId);
    const imageData = firebaseReady && selectedProductFile
      ? await uploadImage(selectedProductFile, "products")
      : null;

    const productData = {
      categoryId: productCategoryInput.value,
      name: productNameInput.value.trim(),
      price: Number(priceInput.value),
      phone,
      image: imageData?.image || selectedProductPhoto,
      imagePath: imageData?.imagePath || existingProduct?.imagePath || ""
    };

    localStorage.setItem(PHONE_KEY, phone);

    if (firebaseReady) {
      if (editingProductId) {
        await firebaseApi.updateDoc(firebaseApi.doc(firebaseApi.db, "products", editingProductId), productData);
        if (imageData && existingProduct?.imagePath) {
          await deleteStoredImage(existingProduct.imagePath);
        }
      } else {
        await firebaseApi.addDoc(firebaseApi.collection(firebaseApi.db, "products"), {
          ...productData,
          createdAt: firebaseApi.serverTimestamp()
        });
      }
    } else if (editingProductId) {
      products = products.map((product) =>
        product.id === editingProductId ? { ...product, ...productData } : product
      );
      saveLocalShop();
      renderAll();
    } else {
      products = [{ id: makeId(), ...productData }, ...products];
      saveLocalShop();
      renderAll();
    }

    selectedCategoryId = productCategoryInput.value;
    productsSection.classList.remove("is-hidden");
    cancelEdit();
    setStatus("Product saved.");
    openCategory(selectedCategoryId);
  } catch (error) {
    setStatus(error.message || "Product could not be saved.");
  } finally {
    saveProductButton.disabled = false;
    saveProductButton.textContent = editingProductId ? "Update Product" : "Save Product";
  }
});

cancelEditButton.addEventListener("click", cancelEdit);

phoneInput.value = localStorage.getItem(PHONE_KEY) || "919876543210";
const localShop = readLocalShop();
categories = localShop.categories;
products = localShop.products;
renderAll();

try {
  await setupFirebase();
} catch {
  setStatus("Firebase is not connected yet. The site is using local browser storage.");
}

window.addEventListener("beforeunload", () => {
  unsubscribeCategories?.();
  unsubscribeProducts?.();
});
