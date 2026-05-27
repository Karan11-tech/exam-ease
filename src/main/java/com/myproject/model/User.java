package com.myproject.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "users")  // MongoDB collection name
public class User {
    
    @Id
    private String id;
    private String name;
    private String email;
    private int progress;

    // Constructors
    public User() {}

    public User(String name, String email, int progress) {
        this.name = name;
        this.email = email;
        this.progress = progress;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public int getProgress() { return progress; }
    public void setProgress(int progress) { this.progress = progress; }
}
