migrate((db) => {
  const collection = new Collection({
    "id": "assets_collection",
    "name": "assets",
    "type": "base",
    "system": false,
    "schema": [
      {
        "id": "asset_name",
        "name": "name",
        "type": "text",
        "required": true,
        "options": {
          "min": 1,
          "max": 200
        }
      },
      {
        "id": "asset_description",
        "name": "description",
        "type": "text",
        "required": false,
        "options": {
          "min": null,
          "max": 1000
        }
      },
      {
        "id": "asset_file",
        "name": "file",
        "type": "file",
        "required": true,
        "options": {
          "maxSelect": 1,
          "maxSize": 104857600,
          "mimeTypes": [
            "model/gltf-binary",
            "model/gltf+json",
            "application/octet-stream"
          ]
        }
      },
      {
        "id": "asset_thumbnail",
        "name": "thumbnail",
        "type": "file",
        "required": false,
        "options": {
          "maxSelect": 1,
          "maxSize": 5242880,
          "mimeTypes": [
            "image/jpeg",
            "image/png",
            "image/webp"
          ]
        }
      },
      {
        "id": "asset_tags",
        "name": "tags",
        "type": "json",
        "required": false,
        "options": {}
      },
      {
        "id": "asset_user",
        "name": "user",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "_pb_users_auth_",
          "cascadeDelete": false,
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": []
        }
      }
    ],
    "indexes": [
      "CREATE INDEX idx_assets_user ON assets (user)",
      "CREATE INDEX idx_assets_created ON assets (created)"
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''",
    "createRule": "@request.auth.id != '' && @request.auth.id = user",
    "updateRule": "@request.auth.id = user",
    "deleteRule": "@request.auth.id = user"
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("assets_collection");

  return dao.deleteCollection(collection);
})
