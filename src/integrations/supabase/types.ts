export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          active: boolean
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          active?: boolean
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          active?: boolean
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          active: boolean
          chat_id: string
          content: string
          created_at: string
          id: string
          message_type: string
          metadata: Json | null
          sender_id: string | null
          sender_type: string
        }
        Insert: {
          active?: boolean
          chat_id: string
          content: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          sender_id?: string | null
          sender_type: string
        }
        Update: {
          active?: boolean
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          sender_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          active: boolean
          created_at: string
          customer_id: string
          id: string
          sale_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id: string
          id?: string
          sale_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: string
          id?: string
          sale_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          active: boolean
          city: string
          complement: string | null
          created_at: string
          customer_id: string
          id: string
          label: string
          neighborhood: string
          number: string
          reference: string | null
          street: string
        }
        Insert: {
          active?: boolean
          city: string
          complement?: string | null
          created_at?: string
          customer_id: string
          id?: string
          label: string
          neighborhood: string
          number: string
          reference?: string | null
          street: string
        }
        Update: {
          active?: boolean
          city?: string
          complement?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          label?: string
          neighborhood?: string
          number?: string
          reference?: string | null
          street?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          address: string | null
          auth_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          auth_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          auth_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_products: {
        Row: {
          active: boolean
          id: string
          position: number | null
          product_id: string
        }
        Insert: {
          active?: boolean
          id?: string
          position?: number | null
          product_id: string
        }
        Update: {
          active?: boolean
          id?: string
          position?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_products_tenant: {
        Row: {
          active: boolean
          created_at: string
          id: string
          position: number | null
          product_id: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          position?: number | null
          product_id: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          position?: number | null
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_products_tenant_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_products_tenant_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      home_categories: {
        Row: {
          active: boolean
          icon_url: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          icon_url?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          icon_url?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      layouts: {
        Row: {
          active: boolean
          config: Json | null
          id: string
          name: string
          preview_image_url: string | null
        }
        Insert: {
          active?: boolean
          config?: Json | null
          id?: string
          name: string
          preview_image_url?: string | null
        }
        Update: {
          active?: boolean
          config?: Json | null
          id?: string
          name?: string
          preview_image_url?: string | null
        }
        Relationships: []
      }
      mini_promo_banners: {
        Row: {
          active: boolean
          id: string
          image_url: string
          link: string | null
          tenant_id: string
        }
        Insert: {
          active?: boolean
          id?: string
          image_url: string
          link?: string | null
          tenant_id: string
        }
        Update: {
          active?: boolean
          id?: string
          image_url?: string
          link?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mini_promo_banners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          active: boolean
          id: string
          order_id: string
          price: number
          product_id: string
          quantity: number
        }
        Insert: {
          active?: boolean
          id?: string
          order_id: string
          price?: number
          product_id: string
          quantity?: number
        }
        Update: {
          active?: boolean
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          active: boolean
          created_at: string
          customer_id: string | null
          delivery_type: string
          id: string
          origin: string
          payment_method: string | null
          status: string
          tenant_id: string
          total: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          delivery_type?: string
          id?: string
          origin?: string
          payment_method?: string | null
          status?: string
          tenant_id: string
          total?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          delivery_type?: string
          id?: string
          origin?: string
          payment_method?: string | null
          status?: string
          tenant_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          active: boolean
          created_at: string
          emoji: string | null
          id: string
          name: string
          slug: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          slug: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_category_relations: {
        Row: {
          active: boolean
          category_id: string
          product_id: string
        }
        Insert: {
          active?: boolean
          category_id: string
          product_id: string
        }
        Update: {
          active?: boolean
          category_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_category_relations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_relations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          active: boolean
          id: string
          image_url: string
          position: number
          product_id: string
        }
        Insert: {
          active?: boolean
          id?: string
          image_url: string
          position?: number
          product_id: string
        }
        Update: {
          active?: boolean
          id?: string
          image_url?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock: {
        Row: {
          active: boolean
          min_quantity: number
          product_id: string
          quantity: number
          tenant_id: string
        }
        Insert: {
          active?: boolean
          min_quantity?: number
          product_id: string
          quantity?: number
          tenant_id: string
        }
        Update: {
          active?: boolean
          min_quantity?: number
          product_id?: string
          quantity?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          active: boolean
          id: string
          product_id: string
          tag_id: string
        }
        Insert: {
          active?: boolean
          id?: string
          product_id: string
          tag_id: string
        }
        Update: {
          active?: boolean
          id?: string
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          has_discount: boolean
          id: string
          name: string
          price: number
          promo_price: number | null
          slug: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          has_discount?: boolean
          id?: string
          name: string
          price?: number
          promo_price?: number | null
          slug: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          has_discount?: boolean
          id?: string
          name?: string
          price?: number
          promo_price?: number | null
          slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          auth_id: string | null
          cargo: string | null
          cpf: string | null
          created_at: string
          id: string
          login: string
          must_change_password: boolean
          name: string | null
          password_hash: string
          role: string
          tenant_id: string | null
        }
        Insert: {
          active?: boolean
          auth_id?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          login: string
          must_change_password?: boolean
          name?: string | null
          password_hash: string
          role?: string
          tenant_id?: string | null
        }
        Update: {
          active?: boolean
          auth_id?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          login?: string
          must_change_password?: boolean
          name?: string | null
          password_hash?: string
          role?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_banners: {
        Row: {
          active: boolean
          id: string
          image_url: string
          link: string | null
          position: number | null
          tenant_id: string
        }
        Insert: {
          active?: boolean
          id?: string
          image_url: string
          link?: string | null
          position?: number | null
          tenant_id: string
        }
        Update: {
          active?: boolean
          id?: string
          image_url?: string
          link?: string | null
          position?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_banners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          id: string
          payment_method: string
          registered_by: string | null
          sale_id: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          amount?: number
          created_at?: string
          id?: string
          payment_method: string
          registered_by?: string | null
          sale_id: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          id?: string
          payment_method?: string
          registered_by?: string | null
          sale_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          active: boolean
          chat_id: string | null
          created_at: string
          customer_id: string | null
          delivery_address: Json | null
          financial_status: string
          forma_pagamento: string | null
          id: string
          observacao: string | null
          operational_status: string
          sale_number: number | null
          tenant_id: string
          valor_total: number
        }
        Insert: {
          active?: boolean
          chat_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_address?: Json | null
          financial_status?: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          operational_status?: string
          sale_number?: number | null
          tenant_id: string
          valor_total?: number
        }
        Update: {
          active?: boolean
          chat_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_address?: Json | null
          financial_status?: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          operational_status?: string
          sale_number?: number | null
          tenant_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_read: boolean
          message: string
          product_id: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          product_id: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_configs: {
        Row: {
          active: boolean
          favicon_url: string | null
          id: string
          site_subtitle: string
          site_title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          favicon_url?: string | null
          id?: string
          site_subtitle?: string
          site_title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          favicon_url?: string | null
          id?: string
          site_subtitle?: string
          site_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_users: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          name: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          active: boolean
          created_at: string
          emoji: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          emoji: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      tenant_layouts: {
        Row: {
          active: boolean
          custom_config: Json | null
          layout_id: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          custom_config?: Json | null
          layout_id: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          custom_config?: Json | null
          layout_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_layouts_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "layouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_layouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_section_products: {
        Row: {
          active: boolean
          id: string
          position: number
          product_id: string
          tenant_section_id: string
        }
        Insert: {
          active?: boolean
          id?: string
          position?: number
          product_id: string
          tenant_section_id: string
        }
        Update: {
          active?: boolean
          id?: string
          position?: number
          product_id?: string
          tenant_section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_section_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_section_products_tenant_section_id_fkey"
            columns: ["tenant_section_id"]
            isOneToOne: false
            referencedRelation: "tenant_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_sections: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          id: string
          position: number
          tenant_id: string
          title: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          position?: number
          tenant_id: string
          title: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          position?: number
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_sections_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_sections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          active: boolean
          address: string | null
          category: string | null
          city: string | null
          closing_time: string | null
          cnpj: string | null
          cover_url: string | null
          created_at: string
          free_shipping: boolean | null
          id: string
          latitude: number | null
          layout_id: string | null
          logo_url: string | null
          longitude: number | null
          name: string
          opening_time: string | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          primary_color: string | null
          secondary_color: string | null
          shipping_fee: number | null
          slug: string
          state: string | null
          whatsapp_number: string | null
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          category?: string | null
          city?: string | null
          closing_time?: string | null
          cnpj?: string | null
          cover_url?: string | null
          created_at?: string
          free_shipping?: boolean | null
          id?: string
          latitude?: number | null
          layout_id?: string | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          opening_time?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          shipping_fee?: number | null
          slug: string
          state?: string | null
          whatsapp_number?: string | null
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          category?: string | null
          city?: string | null
          closing_time?: string | null
          cnpj?: string | null
          cover_url?: string | null
          created_at?: string
          free_shipping?: boolean | null
          id?: string
          latitude?: number | null
          layout_id?: string | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          opening_time?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          shipping_fee?: number | null
          slug?: string
          state?: string | null
          whatsapp_number?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tenants_layout"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "layouts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          active: boolean
          current_order_id: string | null
          id: string
          phone: string
          step: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          current_order_id?: string | null
          id?: string
          phone: string
          step?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          current_order_id?: string | null
          id?: string
          phone?: string
          step?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sessions_current_order_id_fkey"
            columns: ["current_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_app_user:
        | {
            Args: {
              _auth_id: string
              _login: string
              _password: string
              _role: string
              _tenant_id: string
            }
            Returns: string
          }
        | {
            Args: {
              _auth_id: string
              _cargo?: string
              _cpf?: string
              _login: string
              _name?: string
              _password: string
              _role: string
              _tenant_id: string
            }
            Returns: string
          }
      get_app_user_role: { Args: { _auth_id: string }; Returns: string }
      get_app_user_tenant_id: { Args: { _auth_id: string }; Returns: string }
      get_customer_by_auth_id: { Args: { _auth_id: string }; Returns: string }
      get_user_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_superadmin: { Args: { _auth_id: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      next_sale_number: { Args: { _tenant_id: string }; Returns: number }
      update_app_user_password: {
        Args: { _password: string; _user_id: string }
        Returns: undefined
      }
      verify_password: {
        Args: { _hash: string; _password: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "manager", "staff"],
    },
  },
} as const
