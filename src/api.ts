import { Platform } from "react-native";
import { createApiClient } from "./api-core";
export type { ApiHealth, CreateInquiryInput, CreateInquiryResult, InquiryStatus, Product } from "./api-core";

const platformDefault = Platform.OS === "android" ? "http://10.0.2.2:4001" : "http://127.0.0.1:4001";
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL?.trim() || platformDefault).replace(/\/+$/, "");

const api = createApiClient(API_BASE_URL);
export const getProducts = api.getProducts;
export const getHealth = api.getHealth;
export const createInquiry = api.createInquiry;
export const trackInquiry = api.trackInquiry;
