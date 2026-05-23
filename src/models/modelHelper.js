const mongoose = require('mongoose');

// In-memory collections database
const mockDB = {};
const modelsRegistry = {};

class MockQuery {
  constructor(data, modelName) {
    this.data = JSON.parse(JSON.stringify(data)); // Deep copy to prevent mutations
    this.modelName = modelName;
  }

  populate(fields) {
    // Support basic population e.g. 'seller', 'customer', 'product', 'items.product'
    if (!fields) return this;
    const paths = typeof fields === 'string' ? fields.split(' ') : [fields];

    for (let path of paths) {
      // Handle simple path like 'seller'
      if (path === 'seller') {
        this.data = this.data.map(doc => {
          if (doc.seller && typeof doc.seller === 'string') {
            const sellerDoc = mockDB['User']?.find(u => u._id === doc.seller) || 
                              mockDB['SellerProfile']?.find(s => s._id === doc.seller) || 
                              mockDB['SellerProfile']?.find(s => s.user === doc.seller);
            if (sellerDoc) {
              return { ...doc, seller: JSON.parse(JSON.stringify(sellerDoc)) };
            }
          }
          return doc;
        });
      }
      if (path === 'customer') {
        this.data = this.data.map(doc => {
          if (doc.customer && typeof doc.customer === 'string') {
            const custDoc = mockDB['User']?.find(u => u._id === doc.customer);
            if (custDoc) {
              return { ...doc, customer: JSON.parse(JSON.stringify(custDoc)) };
            }
          }
          return doc;
        });
      }
      if (path === 'product' || path === 'items.product') {
        this.data = this.data.map(doc => {
          if (path === 'product' && doc.product && typeof doc.product === 'string') {
            const prodDoc = mockDB['Product']?.find(p => p._id === doc.product);
            if (prodDoc) {
              return { ...doc, product: JSON.parse(JSON.stringify(prodDoc)) };
            }
          }
          if (path === 'items.product' && Array.isArray(doc.items)) {
            const updatedItems = doc.items.map(item => {
              if (item.product && typeof item.product === 'string') {
                const prodDoc = mockDB['Product']?.find(p => p._id === item.product);
                if (prodDoc) {
                  return { ...item, product: JSON.parse(JSON.stringify(prodDoc)) };
                }
              }
              return item;
            });
            return { ...doc, items: updatedItems };
          }
          return doc;
        });
      }
    }

    return this;
  }

  sort(sortObj) {
    if (!sortObj) return this;
    const field = Object.keys(sortObj)[0];
    const order = sortObj[field];

    this.data.sort((a, b) => {
      let valA = a[field];
      let valB = b[field];

      if (field === 'createdAt' || field === 'updatedAt') {
        valA = new Date(valA || 0);
        valB = new Date(valB || 0);
      }

      if (valA < valB) return order === -1 || order === 'desc' ? 1 : -1;
      if (valA > valB) return order === -1 || order === 'desc' ? -1 : 1;
      return 0;
    });
    return this;
  }

  limit(n) {
    this.data = this.data.slice(0, n);
    return this;
  }

  skip(n) {
    this.data = this.data.slice(n);
    return this;
  }

  exec() {
    return this.data;
  }

  then(onResolve, onReject) {
    return Promise.resolve(this.data).then(onResolve, onReject);
  }
}

// Generates an In-Memory Mock Model class
const createMockModel = (modelName, schemaObj) => {
  mockDB[modelName] = [];

  class MockModel {
    constructor(data = {}) {
      this._id = data._id || Math.random().toString(36).substring(2, 11);
      this.createdAt = new Date().toISOString();
      this.updatedAt = new Date().toISOString();
      
      // Load default values from schema where not provided
      for (const [key, prop] of Object.entries(schemaObj)) {
        if (data[key] !== undefined) {
          this[key] = data[key];
        } else if (prop && prop.default !== undefined) {
          this[key] = typeof prop.default === 'function' ? prop.default() : prop.default;
        }
      }
    }

    async save() {
      const collection = mockDB[modelName];
      const existingIdx = collection.findIndex(item => item._id === this._id);
      this.updatedAt = new Date().toISOString();

      const docToSave = { ...this };
      if (existingIdx >= 0) {
        collection[existingIdx] = docToSave;
      } else {
        collection.push(docToSave);
      }
      return docToSave;
    }

    static async create(data) {
      const doc = new MockModel(data);
      return await doc.save();
    }

    static _matches(doc, query) {
      if (!query || Object.keys(query).length === 0) return true;

      for (let [key, val] of Object.entries(query)) {
        // Support simple OR condition if needed
        if (key === '$or' && Array.isArray(val)) {
          return val.some(subQuery => MockModel._matches(doc, subQuery));
        }

        // Support case-insensitive regex or keyword search
        if (val && typeof val === 'object' && val.$regex) {
          const docVal = doc[key] || '';
          const regex = new RegExp(val.$regex, val.$options || 'i');
          if (!regex.test(docVal)) return false;
          continue;
        }

        if (val && typeof val === 'object' && val.$gt !== undefined) {
          if (!(doc[key] > val.$gt)) return false;
          continue;
        }

        if (val && typeof val === 'object' && val.$lt !== undefined) {
          if (!(doc[key] < val.$lt)) return false;
          continue;
        }

        if (val && typeof val === 'object' && val.$gte !== undefined) {
          if (!(doc[key] >= val.$gte)) return false;
          continue;
        }

        if (val && typeof val === 'object' && val.$lte !== undefined) {
          if (!(doc[key] <= val.$lte)) return false;
          continue;
        }

        // Standard comparison (case-insensitive for email)
        if (key === 'email' && typeof doc[key] === 'string' && typeof val === 'string') {
          if (doc[key].toLowerCase() !== val.toLowerCase()) return false;
        } else if (doc[key] !== val) {
          return false;
        }
      }
      return true;
    }

    static find(query = {}) {
      const list = mockDB[modelName].filter(doc => MockModel._matches(doc, query));
      return new MockQuery(list, modelName);
    }

    static findOne(query = {}) {
      const item = mockDB[modelName].find(doc => MockModel._matches(doc, query));
      // For findOne, it must return a query wrapper or null
      return item ? new MockQuery(item, modelName) : null;
    }

    static async findById(id) {
      const item = mockDB[modelName].find(doc => doc._id === id);
      return item ? new MockQuery(item, modelName) : null;
    }

    static async findByIdAndUpdate(id, update, options = {}) {
      const collection = mockDB[modelName];
      const idx = collection.findIndex(item => item._id === id);
      if (idx === -1) return null;

      const current = collection[idx];
      let updatedData = { ...current };

      const updatePayload = update.$set || update;
      Object.assign(updatedData, updatePayload);

      // Support pushing into arrays
      if (update.$push) {
        for (const [key, value] of Object.entries(update.$push)) {
          if (!Array.isArray(updatedData[key])) {
            updatedData[key] = [];
          }
          updatedData[key].push(value);
        }
      }

      updatedData.updatedAt = new Date().toISOString();
      collection[idx] = updatedData;
      return JSON.parse(JSON.stringify(updatedData));
    }

    static async findByIdAndDelete(id) {
      const collection = mockDB[modelName];
      const idx = collection.findIndex(item => item._id === id);
      if (idx === -1) return null;
      const removed = collection.splice(idx, 1);
      return removed[0];
    }

    static async deleteOne(query) {
      const collection = mockDB[modelName];
      const idx = collection.findIndex(doc => MockModel._matches(doc, query));
      if (idx === -1) return { deletedCount: 0 };
      collection.splice(idx, 1);
      return { deletedCount: 1 };
    }

    static async countDocuments(query = {}) {
      return mockDB[modelName].filter(doc => MockModel._matches(doc, query)).length;
    }
  }

  modelsRegistry[modelName] = MockModel;
  return MockModel;
};

// Main function to define models
const defineModel = (name, schemaObj) => {
  // If useMockDB is true, define MockModel, otherwise define Mongoose Model
  // We can evaluate global.useMockDB lazily on actual model instantiation or methods
  const schema = new mongoose.Schema(schemaObj, { timestamps: true });
  const MongoModel = mongoose.models[name] || mongoose.model(name, schema);

  const MockModel = createMockModel(name, schemaObj);

  // Return a proxy that forwards calls based on global.useMockDB
  const handler = {
    construct(target, args) {
      if (global.useMockDB) {
        return new MockModel(...args);
      } else {
        return new MongoModel(...args);
      }
    },
    get(target, prop) {
      if (global.useMockDB) {
        return MockModel[prop] || target[prop];
      } else {
        return MongoModel[prop] || target[prop];
      }
    }
  };

  return new Proxy(MongoModel, handler);
};

module.exports = { defineModel, mockDB };
