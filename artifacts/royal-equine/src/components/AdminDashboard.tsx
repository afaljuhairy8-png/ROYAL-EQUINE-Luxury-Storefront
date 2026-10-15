import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Archive,
  ArrowDownUp,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  LayoutGrid,
  LoaderCircle,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import {
  getListAdminOrdersQueryKey,
  getListAdminProductsQueryKey,
  useCreateAdminProduct,
  useDeleteAdminProduct,
  useListAdminOrders,
  useListAdminProducts,
  useUpdateAdminOrder,
  useUpdateAdminProduct,
} from "@workspace/api-client-react";
import type { AdminProductInput, StoreOrder, StoreProduct } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Lang = "en" | "ar";
type Props = { lang: Lang };
type Section = "catalogue" | "orders";

const copy = (lang: Lang, en: string, ar: string) => lang === "ar" ? ar : en;
const money = (value: number) => `${value.toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD`;
const productSchema = z.object({
  name: z.string().min(1).max(160),
  nameAr: z.string().min(1).max(160),
  category: z.string().min(1).max(100),
  categoryAr: z.string().min(1).max(100),
  description: z.string().min(1).max(1200),
  descriptionAr: z.string().min(1).max(1200),
  department: z.enum(["horse", "rider", "care"]),
  price: z.coerce.number().min(0),
  image: z.string().min(1).max(2000),
  badge: z.string().max(80).optional(),
  badgeAr: z.string().max(80).optional(),
  shelf: z.enum(["supplements", "medicine"]).optional(),
});
type ProductForm = z.infer<typeof productSchema>;
const emptyProduct: ProductForm = {
  name: "", nameAr: "", category: "", categoryAr: "", description: "", descriptionAr: "",
  department: "horse", price: 0, image: "", badge: "", badgeAr: "", shelf: undefined,
};

export function AdminDashboard({ lang }: Props) {
  const ar = lang === "ar";
  const rtl = ar ? "rtl" : "ltr";
  const queryClient = useQueryClient();
  const productsQuery = useListAdminProducts();
  const ordersQuery = useListAdminOrders();
  const createProduct = useCreateAdminProduct();
  const updateProduct = useUpdateAdminProduct();
  const deleteProduct = useDeleteAdminProduct();
  const updateOrder = useUpdateAdminOrder();
  const [section, setSection] = useState<Section>("catalogue");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyProduct,
  });
  const visibleProducts = useMemo(() => products.filter((product) => {
    const words = `${product.name} ${product.nameAr} ${product.category} ${product.categoryAr}`.toLowerCase();
    return words.includes(search.toLowerCase()) && (department === "all" || product.department === department);
  }), [products, search, department]);
  const pendingCount = orders.filter((order) => order.status === "pending").length;
  const gross = orders.reduce((sum, order) => sum + order.total, 0);

  const announce = (kind: "success" | "error", text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4200);
  };
  const openCreate = () => {
    setEditing(null);
    form.reset(emptyProduct);
    setFormOpen(true);
  };
  const openEdit = (product: StoreProduct) => {
    setEditing(product);
    form.reset({
      name: product.name, nameAr: product.nameAr, category: product.category, categoryAr: product.categoryAr,
      description: product.description, descriptionAr: product.descriptionAr, department: product.department,
      price: product.price, image: product.image, badge: product.badge ?? "", badgeAr: product.badgeAr ?? "",
      shelf: product.shelf,
    });
    setFormOpen(true);
  };
  const submitProduct = (values: ProductForm) => {
    const data: AdminProductInput = {
      ...values,
      badge: values.badge || undefined,
      badgeAr: values.badgeAr || undefined,
      shelf: values.department === "care" ? values.shelf : undefined,
    };
    const done = () => {
      void queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
      setFormOpen(false);
      announce("success", copy(lang, editing ? "Catalogue entry updated." : "New piece added to the catalogue.", editing ? "تم تحديث المنتج." : "تمت إضافة المنتج إلى الكتالوج."));
    };
    const failed = () => announce("error", copy(lang, "The catalogue could not be saved. Please try again.", "تعذر حفظ المنتج. يرجى المحاولة مرة أخرى."));
    if (editing) updateProduct.mutate({ productId: editing.id, data }, { onSuccess: done, onError: failed });
    else createProduct.mutate({ data }, { onSuccess: done, onError: failed });
  };
  const removeProduct = (productId: string) => {
    if (deleting !== productId) {
      setDeleting(productId);
      return;
    }
    deleteProduct.mutate({ productId }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
        setDeleting(null);
        announce("success", copy(lang, "Piece removed from the catalogue.", "تم حذف المنتج من الكتالوج."));
      },
      onError: () => {
        setDeleting(null);
        announce("error", copy(lang, "This piece could not be removed.", "تعذر حذف هذا المنتج."));
      },
    });
  };
  const setOrderStatus = (order: StoreOrder, status: "pending" | "paid") => {
    updateOrder.mutate({ orderId: order.id, data: { status } }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListAdminOrdersQueryKey() });
        announce("success", copy(lang, `Order ${order.orderNumber} marked ${status}.`, `تم تحديث حالة الطلب ${order.orderNumber}.`));
      },
      onError: () => announce("error", copy(lang, "Order status could not be updated.", "تعذر تحديث حالة الطلب.")),
    });
  };
  const productError = productsQuery.error;
  const orderError = ordersQuery.error;

  return (
    <main className="re-admin" dir={rtl} data-testid="admin-dashboard">
      <div className="re-admin-shell">
        <aside className="re-admin-rail">
          <div className="re-admin-brand">
            <span className="re-admin-seal">RE</span>
            <span><b>ROYAL EQUINE</b><small>{copy(lang, "PRIVATE ATELIER", "الأتيليه الخاص")}</small></span>
          </div>
          <div className="re-admin-rail-label">{copy(lang, "OPERATIONS", "العمليات")}</div>
          <button className={`re-admin-nav ${section === "catalogue" ? "is-active" : ""}`} onClick={() => setSection("catalogue")} data-testid="nav-catalogue">
            <LayoutGrid size={17} /><span>{copy(lang, "Catalogue", "الكتالوج")}</span><b>{products.length}</b>
          </button>
          <button className={`re-admin-nav ${section === "orders" ? "is-active" : ""}`} onClick={() => setSection("orders")} data-testid="nav-orders">
            <ClipboardList size={17} /><span>{copy(lang, "Orders", "الطلبات")}</span>{pendingCount > 0 && <b className="re-admin-pending-count">{pendingCount}</b>}
          </button>
          <div className="re-admin-rail-foot">
            <span className="re-admin-live-dot" />
            <span>{copy(lang, "KUWAIT ATELIER", "أتيليه الكويت")}<small>{copy(lang, "Operations workspace", "مساحة إدارة العمليات")}</small></span>
          </div>
        </aside>

        <section className="re-admin-main">
          <header className="re-admin-topbar">
            <div className="re-admin-breadcrumb"><span>{copy(lang, "ROYAL EQUINE", "رويال إكويني")}</span><i>/</i>{section === "catalogue" ? copy(lang, "Catalogue", "الكتالوج") : copy(lang, "Orders", "الطلبات")}</div>
            <div className="re-admin-user"><span className="re-admin-avatar">RE</span><span><b>{copy(lang, "Atelier manager", "مدير الأتيليه")}</b><small>{copy(lang, "Salmiya · Kuwait", "السالمية · الكويت")}</small></span></div>
          </header>

          <div className="re-admin-content">
            <div className="re-admin-heading">
              <div>
                <div className="re-admin-kicker">{copy(lang, "PRIVATE OPERATIONS · KUWAIT", "العمليات الخاصة · الكويت")}</div>
                <h1>{section === "catalogue" ? copy(lang, "The catalogue", "الكتالوج") : copy(lang, "Client orders", "طلبات العملاء")}</h1>
                <p>{section === "catalogue" ? copy(lang, "Maintain every considered detail across the English and Arabic collection.", "إدارة تفاصيل المجموعة باللغتين الإنجليزية والعربية.") : copy(lang, "A considered view of each client request, from arrival to payment.", "متابعة كل طلب عميل من استلامه وحتى الدفع.")}</p>
              </div>
              {section === "catalogue" && <Button className="re-admin-primary" onClick={openCreate} data-testid="button-add-product"><Plus size={16} />{copy(lang, "Add a piece", "إضافة منتج")}</Button>}
            </div>

            <div className="re-admin-stats">
              <article className="re-admin-stat"><span>{copy(lang, "CATALOGUE PIECES", "منتجات الكتالوج")}</span><b data-testid="metric-products">{products.length.toString().padStart(2, "0")}</b><small><Package size={14} />{copy(lang, "Across three departments", "ضمن ثلاثة أقسام")}</small></article>
              <article className="re-admin-stat"><span>{copy(lang, "ORDERS TO REVIEW", "طلبات للمراجعة")}</span><b data-testid="metric-pending">{pendingCount.toString().padStart(2, "0")}</b><small><ClipboardList size={14} />{copy(lang, "Awaiting payment confirmation", "بانتظار تأكيد الدفع")}</small></article>
              <article className="re-admin-stat re-admin-stat-value"><span>{copy(lang, "ORDER VALUE", "قيمة الطلبات")}</span><b data-testid="metric-order-value">{money(gross)}</b><small><ShoppingBag size={14} />{copy(lang, `${orders.length} client orders in total`, `${orders.length} طلبات عملاء إجمالاً`)}</small></article>
            </div>

            {notice && <div className={`re-admin-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"} data-testid="status-admin-feedback">
              {notice.kind === "success" ? <Check size={16} /> : <CircleAlert size={16} />}{notice.text}
              <button onClick={() => setNotice(null)} aria-label={copy(lang, "Dismiss notice", "إغلاق التنبيه")} data-testid="button-dismiss-notice"><X size={15} /></button>
            </div>}

            {section === "catalogue" ? (
              <section className="re-admin-panel" aria-label={copy(lang, "Product catalogue", "كتالوج المنتجات")}>
                <div className="re-admin-panel-head">
                  <div><h2>{copy(lang, "Collection register", "سجل المجموعة")}</h2><p>{copy(lang, "Bilingual product records for the Royal Equine storefront.", "سجلات المنتجات باللغتين لمتجر رويال إكويني.")}</p></div>
                  <span className="re-admin-record-count">{copy(lang, `${visibleProducts.length} RECORDS`, `${visibleProducts.length} سجلات`)}</span>
                </div>
                <div className="re-admin-toolbar">
                  <label className="re-admin-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy(lang, "Search product or category", "ابحث عن منتج أو فئة")} aria-label={copy(lang, "Search products", "البحث عن المنتجات")} data-testid="input-search-products" /></label>
                  <label className="re-admin-filter"><ArrowDownUp size={14} /><select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label={copy(lang, "Filter department", "تصفية القسم")} data-testid="select-department">
                    <option value="all">{copy(lang, "All departments", "كل الأقسام")}</option>
                    <option value="horse">{copy(lang, "Horse", "الخيل")}</option>
                    <option value="rider">{copy(lang, "Rider", "الفارس")}</option>
                    <option value="care">{copy(lang, "Care", "العناية")}</option>
                  </select><ChevronDown size={14} /></label>
                </div>
                {productsQuery.isLoading ? <div className="re-admin-skeleton" role="status" data-testid="loading-products">{[1, 2, 3, 4].map((item) => <div key={item}><i /><span /><span /></div>)}</div>
                  : productError ? <div className="re-admin-state re-admin-error" role="alert" data-testid="error-products"><CircleAlert /><b>{copy(lang, "Catalogue unavailable", "الكتالوج غير متاح")}</b><span>{copy(lang, "We could not load the collection.", "تعذر تحميل المجموعة.")}</span><button onClick={() => void productsQuery.refetch()} data-testid="button-retry-products">{copy(lang, "Try again", "إعادة المحاولة")}</button></div>
                  : !visibleProducts.length ? <div className="re-admin-state" data-testid="empty-products"><Archive /><b>{copy(lang, products.length ? "No matching pieces" : "The register is ready", products.length ? "لا توجد منتجات مطابقة" : "السجل جاهز")}</b><span>{copy(lang, products.length ? "Try a different search or department." : "Add the first item to begin building the collection.", products.length ? "جرّب بحثاً أو قسماً آخر." : "أضف أول منتج لبدء بناء المجموعة.")}</span>{!products.length && <button onClick={openCreate} data-testid="button-empty-add-product"><Plus size={15} />{copy(lang, "Add first piece", "إضافة أول منتج")}</button>}</div>
                  : <div className="re-admin-product-list" data-testid="list-products">{visibleProducts.map((product) => <article className="re-admin-product" key={product.id} data-testid={`card-product-${product.id}`}>
                    <div className="re-admin-product-image">{product.image ? <img src={product.image} alt={product.name} /> : <Package size={21} />}</div>
                    <div className="re-admin-product-name"><b lang="en">{product.name}</b><span dir="rtl" lang="ar">{product.nameAr}</span><small>{product.category} <i>·</i> {product.categoryAr}</small></div>
                    <div className="re-admin-department"><span>{copy(lang, product.department, product.department === "horse" ? "الخيل" : product.department === "rider" ? "الفارس" : "العناية")}</span>{product.shelf && <small>{product.shelf}</small>}</div>
                    <strong className="re-admin-price" data-testid={`text-price-${product.id}`}>{money(product.price)}</strong>
                    <div className="re-admin-product-actions">
                      {deleting === product.id ? <><span>{copy(lang, "Remove?", "حذف؟")}</span><button className="re-admin-confirm-delete" onClick={() => removeProduct(product.id)} disabled={deleteProduct.isPending} data-testid={`button-confirm-delete-${product.id}`}>{deleteProduct.isPending ? <LoaderCircle className="re-admin-spin" size={15} /> : copy(lang, "Yes", "نعم")}</button><button onClick={() => setDeleting(null)} aria-label={copy(lang, "Cancel delete", "إلغاء الحذف")} data-testid={`button-cancel-delete-${product.id}`}><X size={15} /></button></> : <><button onClick={() => openEdit(product)} aria-label={copy(lang, `Edit ${product.name}`, `تعديل ${product.nameAr}`)} data-testid={`button-edit-product-${product.id}`}><Pencil size={15} /></button><button className="re-admin-delete-icon" onClick={() => removeProduct(product.id)} aria-label={copy(lang, `Delete ${product.name}`, `حذف ${product.nameAr}`)} data-testid={`button-delete-product-${product.id}`}><Trash2 size={15} /></button></>}
                    </div>
                  </article>)}</div>}
              </section>
            ) : (
              <section className="re-admin-panel" aria-label={copy(lang, "Client orders", "طلبات العملاء")}>
                <div className="re-admin-panel-head">
                  <div><h2>{copy(lang, "Order ledger", "دفتر الطلبات")}</h2><p>{copy(lang, "Client, delivery and payment details for the Kuwait atelier.", "بيانات العميل والتوصيل والدفع لأتيليه الكويت.")}</p></div>
                  <span className="re-admin-record-count">{copy(lang, `${orders.length} ORDERS`, `${orders.length} طلبات`)}</span>
                </div>
                {ordersQuery.isLoading ? <div className="re-admin-skeleton" role="status" data-testid="loading-orders">{[1, 2, 3].map((item) => <div key={item}><i /><span /><span /></div>)}</div>
                  : orderError ? <div className="re-admin-state re-admin-error" role="alert" data-testid="error-orders"><CircleAlert /><b>{copy(lang, "Orders unavailable", "الطلبات غير متاحة")}</b><span>{copy(lang, "We could not load client orders.", "تعذر تحميل طلبات العملاء.")}</span><button onClick={() => void ordersQuery.refetch()} data-testid="button-retry-orders">{copy(lang, "Try again", "إعادة المحاولة")}</button></div>
                  : !orders.length ? <div className="re-admin-state" data-testid="empty-orders"><ClipboardList /><b>{copy(lang, "No client orders yet", "لا توجد طلبات عملاء بعد")}</b><span>{copy(lang, "New orders placed through the storefront will be recorded here.", "ستظهر هنا الطلبات الجديدة التي تتم عبر المتجر.")}</span></div>
                  : <div className="re-admin-orders" data-testid="list-orders">{orders.map((order) => <OrderCard key={order.id} order={order} lang={lang} pending={updateOrder.isPending} onStatus={setOrderStatus} />)}</div>}
              </section>
            )}
            <footer className="re-admin-footer"><span>ROYAL EQUINE · KUWAIT</span><span>{copy(lang, "PRIVATE OPERATIONS REGISTER", "سجل العمليات الخاصة")}</span></footer>
          </div>
        </section>
      </div>

      {formOpen && <div className="re-admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
        <section className="re-admin-modal" role="dialog" aria-modal="true" aria-labelledby="re-admin-form-title" data-testid="dialog-product-form" dir={rtl}>
          <header className="re-admin-modal-head"><div><span className="re-admin-kicker">{copy(lang, "COLLECTION REGISTER", "سجل المجموعة")}</span><h2 id="re-admin-form-title">{copy(lang, editing ? "Edit catalogue piece" : "Add a catalogue piece", editing ? "تعديل منتج" : "إضافة منتج")}</h2></div><button onClick={() => setFormOpen(false)} aria-label={copy(lang, "Close form", "إغلاق النموذج")} data-testid="button-close-product-form"><X size={18} /></button></header>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submitProduct)} className="re-admin-form">
              <div className="re-admin-form-section"><b>{copy(lang, "01 / Product identity", "٠١ / تعريف المنتج")}</b><span>{copy(lang, "Paired English and Arabic naming", "اسم المنتج باللغتين")}</span></div>
              <div className="re-admin-form-grid">
                <Field control={form.control} name="name" label={copy(lang, "Product name · English", "اسم المنتج · الإنجليزية")} testId="input-product-name" />
                <Field control={form.control} name="nameAr" label={copy(lang, "Product name · Arabic", "اسم المنتج · العربية")} testId="input-product-name-ar" dir="rtl" />
                <Field control={form.control} name="category" label={copy(lang, "Category · English", "الفئة · الإنجليزية")} testId="input-product-category" />
                <Field control={form.control} name="categoryAr" label={copy(lang, "Category · Arabic", "الفئة · العربية")} testId="input-product-category-ar" dir="rtl" />
              </div>
              <div className="re-admin-form-section"><b>{copy(lang, "02 / Collection details", "٠٢ / تفاصيل المجموعة")}</b><span>{copy(lang, "Department, price and product image", "القسم والسعر وصورة المنتج")}</span></div>
              <div className="re-admin-form-grid">
                <FormField control={form.control} name="department" render={({ field }) => <FormItem><FormLabel>{copy(lang, "Department", "القسم")}</FormLabel><FormControl><select {...field} className="re-admin-input" data-testid="select-product-department"><option value="horse">{copy(lang, "Horse equipment", "معدات الخيل")}</option><option value="rider">{copy(lang, "Rider apparel", "ملابس الفارس")}</option><option value="care">{copy(lang, "Horse care", "العناية بالخيل")}</option></select></FormControl><FormMessage /></FormItem>} />
                <Field control={form.control} name="price" label={copy(lang, "Price · KWD", "السعر · د.ك")} testId="input-product-price" type="number" step="0.001" min="0" />
                <Field control={form.control} name="image" label={copy(lang, "Image URL", "رابط الصورة")} testId="input-product-image" className="re-admin-form-wide" />
                {form.watch("department") === "care" && <FormField control={form.control} name="shelf" render={({ field }) => <FormItem><FormLabel>{copy(lang, "Care shelf", "رف العناية")}</FormLabel><FormControl><select value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value || undefined)} className="re-admin-input" data-testid="select-product-shelf"><option value="">{copy(lang, "Select shelf", "اختر الرف")}</option><option value="supplements">{copy(lang, "Supplements", "المكملات")}</option><option value="medicine">{copy(lang, "Medicine", "الأدوية")}</option></select></FormControl><FormMessage /></FormItem>} />}
                <Field control={form.control} name="badge" label={copy(lang, "Badge · English (optional)", "شارة · الإنجليزية (اختياري)")} testId="input-product-badge" />
                <Field control={form.control} name="badgeAr" label={copy(lang, "Badge · Arabic (optional)", "شارة · العربية (اختياري)")} testId="input-product-badge-ar" dir="rtl" />
              </div>
              <div className="re-admin-form-section"><b>{copy(lang, "03 / Product story", "٠٣ / وصف المنتج")}</b><span>{copy(lang, "A concise description in both languages", "وصف مختصر باللغتين")}</span></div>
              <div className="re-admin-form-grid">
                <Field control={form.control} name="description" label={copy(lang, "Description · English", "الوصف · الإنجليزية")} testId="input-product-description" multiline />
                <Field control={form.control} name="descriptionAr" label={copy(lang, "Description · Arabic", "الوصف · العربية")} testId="input-product-description-ar" multiline dir="rtl" />
              </div>
              <div className="re-admin-form-actions"><Button type="button" variant="outline" onClick={() => setFormOpen(false)} data-testid="button-cancel-product">{copy(lang, "Cancel", "إلغاء")}</Button><Button type="submit" className="re-admin-primary" disabled={createProduct.isPending || updateProduct.isPending} data-testid="button-save-product">{createProduct.isPending || updateProduct.isPending ? <LoaderCircle className="re-admin-spin" size={15} /> : <Check size={15} />}{copy(lang, editing ? "Save changes" : "Add to catalogue", editing ? "حفظ التغييرات" : "إضافة إلى الكتالوج")}</Button></div>
            </form>
          </Form>
        </section>
      </div>}
    </main>
  );
}

function Field({ control, name, label, testId, type = "text", step, min, multiline = false, dir, className = "" }: {
  control: ReturnType<typeof useForm<ProductForm>>["control"];
  name: keyof ProductForm;
  label: string;
  testId: string;
  type?: string;
  step?: string;
  min?: string;
  multiline?: boolean;
  dir?: "rtl";
  className?: string;
}) {
  return <FormField control={control} name={name} render={({ field }) => <FormItem className={className}>
    <FormLabel>{label}</FormLabel><FormControl>{multiline
      ? <Textarea {...field} value={field.value as string ?? ""} dir={dir} className="re-admin-input re-admin-textarea" data-testid={testId} />
      : <Input {...field} value={field.value as string | number ?? ""} type={type} step={step} min={min} dir={dir} className="re-admin-input" data-testid={testId} />}</FormControl><FormMessage />
  </FormItem>} />;
}

function OrderCard({ order, lang, pending, onStatus }: {
  order: StoreOrder;
  lang: Lang;
  pending: boolean;
  onStatus: (order: StoreOrder, status: "pending" | "paid") => void;
}) {
  const ar = lang === "ar";
  const [expanded, setExpanded] = useState(false);
  const customer = `${order.delivery.firstName} ${order.delivery.lastName}`.trim();
  const date = new Date(order.createdAt).toLocaleDateString(ar ? "ar-KW" : "en-KW", { day: "2-digit", month: "short", year: "numeric" });
  return <article className={`re-admin-order ${expanded ? "is-expanded" : ""}`} data-testid={`card-order-${order.id}`}>
    <button className="re-admin-order-summary" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} data-testid={`button-order-details-${order.id}`}>
      <span className="re-admin-order-mark">{order.status === "paid" ? <Check size={17} /> : <ClipboardList size={17} />}</span>
      <span className="re-admin-order-ref"><small>{ar ? "رقم الطلب" : "ORDER REFERENCE"}</small><b>{order.orderNumber}</b></span>
      <span className="re-admin-customer"><b>{customer || (ar ? "عميل" : "Client")}</b><small>{order.delivery.email}</small></span>
      <span className="re-admin-order-date">{date}</span>
      <span className={`re-admin-status ${order.status}`} data-testid={`status-order-${order.id}`}>{order.status === "paid" ? (ar ? "مدفوع" : "Paid") : (ar ? "قيد الانتظار" : "Pending")}</span>
      <strong className="re-admin-order-total">{money(order.total)}</strong>
      <ChevronDown size={16} className="re-admin-order-chevron" />
    </button>
    {expanded && <div className="re-admin-order-detail">
      <div className="re-admin-order-items"><div className="re-admin-detail-label">{ar ? "عناصر الطلب" : "ORDER ITEMS"}</div>{order.items.map((item) => <div className="re-admin-order-item" key={item.productId}>
        {item.image && <img src={item.image} alt="" />}
        <span><b>{ar ? item.nameAr : item.name}</b><small>{ar ? "الكمية" : "Qty"} {item.quantity} <i>·</i> {money(item.price)} {ar ? "للقطعة" : "each"}</small></span>
        <strong>{money(item.price * item.quantity)}</strong>
      </div>)}</div>
      <div className="re-admin-delivery"><div className="re-admin-detail-label">{ar ? "تفاصيل التوصيل" : "DELIVERY DETAILS"}</div><b>{customer}</b><span>{order.delivery.phone} · {order.delivery.area}</span><span>{order.delivery.address}</span>{order.delivery.notes && <small>{order.delivery.notes}</small>}</div>
      <div className="re-admin-order-bottom"><span>{ar ? "طريقة الدفع" : "PAYMENT"}<b>{ar ? "ترتيب عبر فريق الأتيليه" : "Concierge arrangement"}</b></span><button className="re-admin-status-toggle" onClick={() => onStatus(order, order.status === "pending" ? "paid" : "pending")} disabled={pending} data-testid={`button-toggle-order-status-${order.id}`}>{pending ? <LoaderCircle size={14} className="re-admin-spin" /> : <Check size={14} />}{order.status === "pending" ? (ar ? "تأكيد الدفع" : "Mark as paid") : (ar ? "إعادة إلى الانتظار" : "Reopen as pending")}</button></div>
    </div>}
  </article>;
}
