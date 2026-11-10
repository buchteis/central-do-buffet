it("uses GROQ_API_KEY, the Groq endpoint, and the configured model", async () => {
    expect(GROQ_MODEL).toBe("gemma2-9b-it");
    fetchMock.mockResolvedValue(Response.json({ choices: [{ message: { content: "Olá" } }] }));
