package com.myproject;

import com.mongodb.client.*;
import org.bson.Document;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;

public class MongoDBConnection {
    public static void main(String[] args) {
        // Connect to MongoDB
        String uri = "mongodb://localhost:27017"; // Update if needed
        try (MongoClient mongoClient = MongoClients.create(uri)) {
            MongoDatabase database = mongoClient.getDatabase("mydatabase");
            MongoCollection<Document> collection = database.getCollection("users");

            // CREATE - Insert a document
            Document newUser = new Document("name", "John Doe")
                    .append("age", 25)
                    .append("email", "johndoe@example.com");
            collection.insertOne(newUser);
            System.out.println("Inserted a new user!");

            // READ - Fetch and display all documents
            System.out.println("Fetching all users:");
            try (MongoCursor<Document> cursor = collection.find().iterator()) {
                while (cursor.hasNext()) {
                    System.out.println(cursor.next().toJson());
                }
            }

            // UPDATE - Modify a document
            collection.updateOne(Filters.eq("name", "John Doe"), Updates.set("age", 26));
            System.out.println("Updated John's age to 26!");

            // DELETE - Remove a document
            collection.deleteOne(Filters.eq("name", "John Doe"));
            System.out.println("Deleted user John Doe!");

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
