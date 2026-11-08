export type Product = {
  id: string;
  name: string;
  category: string;
  origin: string;
  unit: string;
};

export type InquiryStatus = {
  status: string;
  createdAt: string;
  productName: string;
};

export type CreateInquiryInput = {
  customerName: string;
  customerEmail: string;
  destinationCountry: string;
  productId: string;
  quantity: number;
};

export type CreateInquiryResult = {
  trackingCode: string;
  status: string;
  createdAt: string;
};

export type SyncStatus = {
  enabled: boolean;
  peerCount: number;
  pendingDeliveries: number;
  retryingDeliveries: number;
  conflicts: number;
};

export type ApiHealth = {
  status: "ok";
};

async function readJson<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  const errorCode =
    payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : undefined;

  if (!response.ok) {
    if (response.status === 429) throw new Error("Batas permintaan tercapai. Coba lagi beberapa menit lagi.");
    if (response.status === 404 && errorCode === "inquiry_not_found") {
      throw new Error("Permintaan tidak ditemukan. Periksa kode pelacakan.");
    }
    if (response.status === 404 && errorCode === "product_not_found") {
      throw new Error("Produk ini sudah tidak tersedia.");
    }
    if (response.status === 400) throw new Error("Periksa kembali data yang dimasukkan.");
    throw new Error("API tidak dapat memproses permintaan. Pastikan server berjalan.");
  }

  if (payload === undefined || payload === null) {
    throw new Error("API mengirim respons yang tidak valid.");
  }
  return payload as T;
}

export function createApiClient(apiBaseUrl: string, fetcher: typeof fetch = fetch) {
  const baseUrl = apiBaseUrl.trim().replace(/\/+$/, "");

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}${path}`, init);
    } catch {
      throw new Error("Tidak dapat terhubung ke server. Periksa koneksi dan alamat API.");
    }
    return readJson<T>(response);
  }

  return {
    async getHealth(): Promise<ApiHealth> {
      const health = await requestJson<ApiHealth>("/health");
      if (health.status !== "ok") throw new Error("API belum siap.");
      return health;
    },

    async getProducts(): Promise<Product[]> {
      const result = await requestJson<{ data: Product[] }>("/api/v1/products");
      return result.data;
    },

    createInquiry(input: CreateInquiryInput): Promise<CreateInquiryResult> {
      return requestJson<CreateInquiryResult>("/api/v1/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    },

    async trackInquiry(code: string): Promise<InquiryStatus> {
      const encodedCode = encodeURIComponent(code.trim().toUpperCase());
      const result = await requestJson<{ data: InquiryStatus }>(`/api/v1/inquiries/${encodedCode}`);
      return result.data;
    },
  };
}
