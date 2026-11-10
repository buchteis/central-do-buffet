it("uses GROQ_API_KEY, the Groq endpoint, and the configured model", async () => {
    expect(GROQ_MODEL).toBe("mixtral-8x7b-32768");
    fetchMock.mockResolvedValue(Response.json({ choices: [{ message: { content: "Olá" } }] }));
